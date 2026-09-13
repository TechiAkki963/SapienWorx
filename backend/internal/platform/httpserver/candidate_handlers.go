package httpserver

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
)

func (s *Server) listJobs(w http.ResponseWriter,r *http.Request){page,_:=strconv.Atoi(r.URL.Query().Get("page"));limit,_:=strconv.Atoi(r.URL.Query().Get("limit"));result,err:=s.candidate.ListJobs(r.Context(),candidate.JobFilters{Query:r.URL.Query().Get("q"),Location:r.URL.Query().Get("location"),WorkMode:r.URL.Query().Get("work_mode"),Page:page,Limit:limit});if err!=nil{s.writeCandidateError(w,r,err);return};writeJSON(w,http.StatusOK,result)}
func (s *Server) getJob(w http.ResponseWriter,r *http.Request){job,err:=s.candidate.Job(r.Context(),r.PathValue("jobID"));if err!=nil{s.writeCandidateError(w,r,err);return};writeJSON(w,http.StatusOK,job)}
func candidateID(r *http.Request)(string,bool){claims,ok:=ClaimsFromContext(r.Context());return claims.Subject,ok}
func (s *Server) candidateDashboard(w http.ResponseWriter,r *http.Request){id,ok:=candidateID(r);if !ok{return};result,err:=s.candidate.Dashboard(r.Context(),id);if err!=nil{s.writeCandidateError(w,r,err);return};writeJSON(w,http.StatusOK,result)}
func (s *Server) candidateProfile(w http.ResponseWriter,r *http.Request){id,ok:=candidateID(r);if !ok{return};if r.Method==http.MethodGet{result,err:=s.candidate.Profile(r.Context(),id);if err!=nil{s.writeCandidateError(w,r,err);return};writeJSON(w,http.StatusOK,result);return};var input candidate.ProfileUpdate;if !decodeJSON(w,r,&input){return};result,err:=s.candidate.UpdateProfile(r.Context(),id,input);if err!=nil{s.writeCandidateError(w,r,err);return};writeJSON(w,http.StatusOK,result)}
func (s *Server) candidateApplications(w http.ResponseWriter,r *http.Request){id,ok:=candidateID(r);if !ok{return};if r.Method==http.MethodGet{items,err:=s.candidate.Applications(r.Context(),id,50);if err!=nil{s.writeCandidateError(w,r,err);return};writeJSON(w,http.StatusOK,map[string]any{"items":items});return};var input struct{JobID string `json:"job_id"`};if !decodeJSON(w,r,&input){return};if strings.TrimSpace(input.JobID)==""{writeError(w,r,http.StatusBadRequest,"validation_error","job_id is required");return};item,err:=s.candidate.Apply(r.Context(),id,input.JobID);if err!=nil{s.writeCandidateError(w,r,err);return};writeJSON(w,http.StatusCreated,item)}
func (s *Server) candidateSavedJobs(w http.ResponseWriter,r *http.Request){id,ok:=candidateID(r);if !ok{return};items,err:=s.candidate.SavedJobs(r.Context(),id);if err!=nil{s.writeCandidateError(w,r,err);return};writeJSON(w,http.StatusOK,map[string]any{"items":items})}
func (s *Server) candidateSavedJob(w http.ResponseWriter,r *http.Request){id,ok:=candidateID(r);if !ok{return};jobID:=r.PathValue("jobID");var err error;if r.Method==http.MethodPut{err=s.candidate.SaveJob(r.Context(),id,jobID)}else{err=s.candidate.UnsaveJob(r.Context(),id,jobID)};if err!=nil{s.writeCandidateError(w,r,err);return};w.WriteHeader(http.StatusNoContent)}
func (s *Server) candidateNotifications(w http.ResponseWriter,r *http.Request){id,ok:=candidateID(r);if !ok{return};items,err:=s.candidate.Notifications(r.Context(),id,50);if err!=nil{s.writeCandidateError(w,r,err);return};writeJSON(w,http.StatusOK,map[string]any{"items":items})}
func (s *Server) candidateNotificationRead(w http.ResponseWriter,r *http.Request){id,ok:=candidateID(r);if !ok{return};if err:=s.candidate.MarkNotificationRead(r.Context(),id,r.PathValue("notificationID"));err!=nil{s.writeCandidateError(w,r,err);return};w.WriteHeader(http.StatusNoContent)}
func (s *Server) writeCandidateError(w http.ResponseWriter,r *http.Request,err error){switch{case errors.Is(err,candidate.ErrNotFound):writeError(w,r,http.StatusNotFound,"not_found","resource was not found");case errors.Is(err,candidate.ErrAlreadyApplied):writeError(w,r,http.StatusConflict,"already_applied","you have already applied to this job");case errors.Is(err,candidate.ErrInactiveJob):writeError(w,r,http.StatusConflict,"job_inactive","this job is not accepting applications");default:if strings.Contains(err.Error(),"required")||strings.Contains(err.Error(),"negative"){writeError(w,r,http.StatusBadRequest,"validation_error",err.Error());return};s.logger.Error("candidate operation failed","error",err,"request_id",RequestIDFromContext(r.Context()));writeError(w,r,http.StatusInternalServerError,"internal_error","candidate operation could not be completed")}}
