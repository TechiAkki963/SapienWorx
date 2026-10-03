data "aws_iam_policy_document" "runtime_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = [data.aws_iam_role.shared.arn]
    }
  }
}

resource "aws_iam_role" "application" {
  name               = "${local.name_prefix}-application"
  assume_role_policy = data.aws_iam_policy_document.runtime_assume_role.json
}


data "aws_iam_policy_document" "application" {
  statement {
    sid       = "ReadBetaRuntimeReleases"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.documents.arn}/releases/*"]
  }
  statement {
    sid       = "ECRAuthorization"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "PullApplicationImages"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = values(aws_ecr_repository.application)[*].arn
  }

  statement {
    sid    = "ReadRuntimeParameters"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.parameter_path}/*",
    ]
  }

  statement {
    sid       = "DecryptSSMParameters"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:PARAMETER_ARN"
      values = [
        "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.parameter_path}/*",
      ]
    }
  }

  statement {
    sid    = "SendTransactionalEmail"
    effect = "Allow"
    actions = [
      "ses:SendEmail",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.ses_identity_domain}",
    ]
  }

  statement {
    sid    = "ReadSESSendingAndSuppressionState"
    effect = "Allow"
    actions = [
      "ses:GetAccount",
      "ses:GetSuppressedDestination",
      "ses:ListSuppressedDestinations",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "UsePrivateUserAndCandidateDocuments"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = [
      "${aws_s3_bucket.documents.arn}/candidate-cv/*",
      "${aws_s3_bucket.documents.arn}/profile-images/*",
    ]
  }

  statement {
    sid       = "PublishHostMetrics"
    effect    = "Allow"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["SapienWorx/Host"]
    }
  }

  statement {
    sid    = "PublishApplicationLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
    ]
    resources = [
      aws_cloudwatch_log_group.host.arn,
      "${aws_cloudwatch_log_group.host.arn}:*",
      aws_cloudwatch_log_group.application.arn,
      "${aws_cloudwatch_log_group.application.arn}:*",
    ]
  }
}

resource "aws_iam_policy" "application" {
  name   = "${local.name_prefix}-application"
  policy = data.aws_iam_policy_document.application.json
}

resource "aws_iam_role_policy_attachment" "application" {
  role       = aws_iam_role.application.name
  policy_arn = aws_iam_policy.application.arn
}



data "aws_iam_policy_document" "github_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [var.github_oidc_subject]
    }
  }
}

resource "aws_iam_role" "github_deployment" {
  name               = "${local.name_prefix}-github-deployment"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role.json
}

data "aws_iam_policy_document" "github_deployment" {
  statement {
    sid       = "PublishBetaRuntimeReleases"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.documents.arn}/releases/*"]
  }
  statement {
    sid       = "ECRAuthorization"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "PushImmutableReleaseImages"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = values(aws_ecr_repository.application)[*].arn
  }

  statement {
    sid     = "DeployBetaOnApprovedSharedInstance"
    effect  = "Allow"
    actions = ["ssm:SendCommand"]
    resources = [
      data.aws_instance.shared.arn,
      "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}::document/AWS-RunShellScript",
    ]
  }

  statement {
    sid    = "ReadDeploymentStatus"
    effect = "Allow"
    actions = [
      "ec2:DescribeInstances",
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "github_deployment" {
  name   = "${local.name_prefix}-github-deployment"
  policy = data.aws_iam_policy_document.github_deployment.json
}

resource "aws_iam_role_policy_attachment" "github_deployment" {
  role       = aws_iam_role.github_deployment.name
  policy_arn = aws_iam_policy.github_deployment.arn
}

# Add only the permission to assume beta's role; do not replace the host profile.
data "aws_iam_policy_document" "host_assume_beta" {
  statement {
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    resources = [aws_iam_role.application.arn]
  }
}
resource "aws_iam_policy" "host_assume_beta" {
  name   = "${local.name_prefix}-host-assume-runtime"
  policy = data.aws_iam_policy_document.host_assume_beta.json
}
resource "aws_iam_role_policy_attachment" "host_assume_beta" {
  role       = data.aws_iam_role.shared.name
  policy_arn = aws_iam_policy.host_assume_beta.arn
}
