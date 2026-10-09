param(
    [string]$BaseUrl = "http://localhost:18080",
    [string]$ProjectName = "swx-controlled-test"
)

$ErrorActionPreference = "Stop"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Invoke-Json {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body,
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session
    )
    $parameters = @{
        Method      = $Method
        Uri         = "$BaseUrl$Path"
        ContentType = "application/json"
    }
    if ($null -ne $Body) { $parameters.Body = $Body | ConvertTo-Json -Depth 8 -Compress }
    if ($null -ne $Session) { $parameters.WebSession = $Session }
    Invoke-RestMethod @parameters
}

$run = [Guid]::NewGuid().ToString("N").Substring(0, 10)
$password = "Controlled-test-$run!"
$candidateEmail = "candidate-$run@controlled.test"
$recruiterEmail = "recruiter-$run@controlled.test"
$candidateSession = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$recruiterSession = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$passes = [System.Collections.Generic.List[string]]::new()

$candidate = Invoke-Json POST "/api/v1/auth/candidate/register" @{
    full_name = "Controlled Candidate"
    email = $candidateEmail
    phone = ""
    password = $password
    privacy_consent = $true
    privacy_policy_version = "privacy-v3-2026-09-17"
    age_confirmed = $true
} $null
Assert-True ($candidate.development_otp -match '^\d{6}$') "Candidate development OTP was not returned."
Invoke-Json POST "/api/v1/auth/email/verify" @{ email = $candidateEmail; code = $candidate.development_otp } $null | Out-Null
Invoke-Json POST "/api/v1/auth/login" @{ email = $candidateEmail; password = $password; role = "candidate" } $candidateSession | Out-Null
$candidateMe = Invoke-Json GET "/api/v1/auth/me" $null $candidateSession
Assert-True ($candidateMe.role -eq "candidate") "Candidate session role mismatch."
$passes.Add("candidate registration, email verification and login")

$recruiter = Invoke-Json POST "/api/v1/auth/recruiter/register" @{
    full_name = "Controlled Recruiter"
    email = $recruiterEmail
    phone = ""
    password = $password
    company_name = "Controlled Test Company"
    designation = "Talent Partner"
    privacy_consent = $true
    privacy_policy_version = "privacy-v3-2026-09-17"
} $null
Assert-True ($recruiter.development_otp -match '^\d{6}$') "Recruiter development OTP was not returned."
Invoke-Json POST "/api/v1/auth/email/verify" @{ email = $recruiterEmail; code = $recruiter.development_otp } $null | Out-Null

$parsedRecruiterID = [Guid]::Empty
Assert-True ([Guid]::TryParse([string]$recruiter.user_id, [ref]$parsedRecruiterID)) "Recruiter id is not a UUID."
$postgresContainer = "$ProjectName-postgres-1"
$approvalSql = "UPDATE recruiter_profiles SET verification_status='verified',verified_at=now() WHERE user_id='$parsedRecruiterID'; UPDATE companies SET verification_status='verified',verified_at=now() WHERE id=(SELECT company_id FROM recruiter_profiles WHERE user_id='$parsedRecruiterID'); UPDATE users SET status='active' WHERE id='$parsedRecruiterID' AND email_verified_at IS NOT NULL;"
docker exec $postgresContainer psql -v ON_ERROR_STOP=1 -U sapienworx -d sapienworx -c $approvalSql | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Local recruiter approval fixture failed." }

Invoke-Json POST "/api/v1/auth/login" @{ email = $recruiterEmail; password = $password; role = "recruiter" } $recruiterSession | Out-Null
$recruiterDashboard = Invoke-Json GET "/api/v1/recruiter/dashboard" $null $recruiterSession
Assert-True ($recruiterDashboard.company_name -eq "Controlled Test Company") "Recruiter dashboard company mismatch."
$passes.Add("recruiter verification, approval, login and dashboard")

$job = Invoke-Json POST "/api/v1/recruiter/jobs" @{
    title = "Controlled Platform Engineer"
    department = "Engineering"
    description = "Controlled functional test role"
    employment_type = "full_time"
    work_mode = "hybrid"
    city = "Bengaluru"
    state = "Karnataka"
    country_code = "IN"
    min_experience_months = 24
    max_experience_months = 60
    openings = 1
    application_deadline = (Get-Date).AddDays(14).ToString("yyyy-MM-dd")
    publish = $true
} $recruiterSession
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$job.id)) "Job creation did not return an id."
$jobs = Invoke-Json GET "/api/v1/jobs" $null $null
Assert-True (($jobs.items | Where-Object id -eq $job.id).Count -eq 1) "Published job was not discoverable."
$passes.Add("job creation and public discovery")

Invoke-Json PUT "/api/v1/candidate/saved-jobs/$($job.id)" $null $candidateSession | Out-Null
$application = Invoke-Json POST "/api/v1/candidate/applications" @{ job_id = $job.id } $candidateSession
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$application.id)) "Application did not return an id."
$candidateApplications = Invoke-Json GET "/api/v1/candidate/applications" $null $candidateSession
Assert-True (($candidateApplications.items | Where-Object id -eq $application.id).Count -eq 1) "Candidate application was not listed."
$passes.Add("saved job and candidate application")

$pipeline = Invoke-Json GET "/api/v1/recruiter/pipeline?limit=20" $null $recruiterSession
$pipelineRow = $pipeline.items | Where-Object application_id -eq $application.id | Select-Object -First 1
Assert-True ($null -ne $pipelineRow) "Application was not visible in recruiter pipeline."
Invoke-Json PATCH "/api/v1/recruiter/applications/$($application.id)/stage" @{ stage = "shortlisted" } $recruiterSession | Out-Null
$passes.Add("recruiter pipeline and stage transition")

$interview = Invoke-Json POST "/api/v1/recruiter/interviews" @{
    application_id = $application.id
    scheduled_at = (Get-Date).AddDays(2).ToUniversalTime().ToString("o")
    duration_minutes = 45
    meeting_url = "https://meet.example.test/controlled-interview"
    notes = "Controlled functional test"
} $recruiterSession
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$interview.id)) "Interview scheduling did not return an id."
$candidateInterviews = Invoke-Json GET "/api/v1/candidate/interviews" $null $candidateSession
Assert-True (($candidateInterviews.items | Where-Object id -eq $interview.id).Count -eq 1) "Interview was not visible to candidate."
$passes.Add("interview scheduling and candidate visibility")

$inmail = Invoke-Json POST "/api/v1/recruiter/inmail" @{
    candidate_id = $pipelineRow.candidate_id
    job_id = $job.id
    subject = "Controlled hiring conversation"
    content = "This is an isolated functional test message."
} $recruiterSession
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$inmail.thread.id)) "InMail did not create a thread."
$threads = Invoke-Json GET "/api/v1/messaging/threads" $null $candidateSession
Assert-True (($threads.items | Where-Object id -eq $inmail.thread.id).Count -eq 1) "InMail thread was not visible to candidate."
Invoke-Json POST "/api/v1/messaging/threads/$($inmail.thread.id)/messages" @{ content = "Controlled candidate reply." } $candidateSession | Out-Null
$passes.Add("InMail and two-way messaging")

$accessCookie = $candidateSession.Cookies.GetCookies($BaseUrl)["sw_access"]
Assert-True ($null -ne $accessCookie) "Candidate access cookie is missing."
$socket = [Net.WebSockets.ClientWebSocket]::new()
$socket.Options.SetRequestHeader("Cookie", "sw_access=$($accessCookie.Value)")
$socket.Options.SetRequestHeader("Origin", $BaseUrl)
$wsUri = [Uri](($BaseUrl -replace '^http', 'ws') + "/api/v1/messaging/threads/$($inmail.thread.id)/ws")
$timeout = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(10))
$socket.ConnectAsync($wsUri, $timeout.Token).GetAwaiter().GetResult()
Assert-True ($socket.State -eq [Net.WebSockets.WebSocketState]::Open) "Authenticated WebSocket did not open."
$socket.CloseAsync([Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "controlled test", [Threading.CancellationToken]::None).GetAwaiter().GetResult()
$socket.Dispose()
$passes.Add("authenticated WebSocket handshake")

Invoke-Json GET "/api/v1/candidate/profile" $null $candidateSession | Out-Null
Invoke-Json GET "/api/v1/candidate/dashboard" $null $candidateSession | Out-Null
Invoke-Json GET "/api/v1/candidate/notifications" $null $candidateSession | Out-Null
Invoke-Json POST "/api/v1/auth/refresh" $null $candidateSession | Out-Null
$passes.Add("candidate profile, dashboard, notifications and session refresh")

Invoke-Json POST "/api/v1/auth/logout" $null $candidateSession | Out-Null
$afterLogout = Invoke-WebRequest -Method GET -Uri "$BaseUrl/api/v1/auth/me" -WebSession $candidateSession -SkipHttpErrorCheck
Assert-True ($afterLogout.StatusCode -eq 401) "Session remained authenticated after logout."
$passes.Add("logout and session revocation")

$publicRoutes = @("/", "/jobs", "/login", "/signup", "/recruiter/login", "/privacy", "/subprocessors")
foreach ($route in $publicRoutes) {
    $response = Invoke-WebRequest -Method GET -Uri "$BaseUrl$route" -SkipHttpErrorCheck
    Assert-True ($response.StatusCode -eq 200) "Public route $route returned $($response.StatusCode)."
}
$passes.Add("landing, authentication and privacy pages")

Write-Output "CONTROLLED STACK SMOKE TEST PASSED"
$passes | ForEach-Object { Write-Output "PASS: $_" }
