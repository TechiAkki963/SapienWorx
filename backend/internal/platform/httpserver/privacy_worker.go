package httpserver

import "context"

// RunPrivacyFulfilmentPass processes asynchronous privacy jobs that require
// private object storage. It is safe to call repeatedly; jobs are claimed with
// row locking and idempotency is enforced by the privacy service.
func (s *Server) RunPrivacyFulfilmentPass(ctx context.Context) (int, error) {
	if s.privacy == nil || s.objectStorage == nil {
		return 0, nil
	}
	return s.privacy.ProcessPendingFulfilmentJobs(ctx, s.objectStorage, 10)
}
