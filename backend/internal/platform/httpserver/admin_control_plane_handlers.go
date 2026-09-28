package httpserver

import (
	"net/http"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
)

func (s *Server) adminControlPlane(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control","no-store")
	result,err:=s.admin.ControlPlane(r.Context())
	if err!=nil{s.writeAdminError(w,r,err);return}
	writeJSON(w,http.StatusOK,result)
}

func (s *Server) adminCreateApproval(w http.ResponseWriter,r *http.Request){
	actor,ok:=adminClaimsID(r);if !ok{writeError(w,r,http.StatusForbidden,"admin_forbidden","master admin access denied");return}
	var input admin.CreateApprovalInput;if !decodeJSON(w,r,&input){return}
	result,err:=s.admin.CreateApproval(r.Context(),actor,input,clientIP(r.RemoteAddr),RequestIDFromContext(r.Context()))
	if err!=nil{s.writeAdminError(w,r,err);return};writeJSON(w,http.StatusCreated,result)
}

func (s *Server) adminDecideApproval(w http.ResponseWriter,r *http.Request){
	actor,ok:=adminClaimsID(r);if !ok{writeError(w,r,http.StatusForbidden,"admin_forbidden","master admin access denied");return}
	var input struct{Decision string `json:"decision"`;Note string `json:"note"`};if !decodeJSON(w,r,&input){return}
	result,err:=s.admin.DecideApproval(r.Context(),strings.TrimSpace(r.PathValue("approvalID")),actor,input.Decision,input.Note,clientIP(r.RemoteAddr),RequestIDFromContext(r.Context()))
	if err!=nil{s.writeAdminError(w,r,err);return};writeJSON(w,http.StatusOK,result)
}

func (s *Server) adminCreateCase(w http.ResponseWriter,r *http.Request){
	actor,ok:=adminClaimsID(r);if !ok{writeError(w,r,http.StatusForbidden,"admin_forbidden","master admin access denied");return}
	var input admin.CreateCaseInput;if !decodeJSON(w,r,&input){return}
	result,err:=s.admin.CreateCase(r.Context(),actor,input,clientIP(r.RemoteAddr),RequestIDFromContext(r.Context()))
	if err!=nil{s.writeAdminError(w,r,err);return};writeJSON(w,http.StatusCreated,result)
}

func (s *Server) adminUpdateCase(w http.ResponseWriter,r *http.Request){
	actor,ok:=adminClaimsID(r);if !ok{writeError(w,r,http.StatusForbidden,"admin_forbidden","master admin access denied");return}
	var input struct{AssignedTo string `json:"assigned_to"`;Status string `json:"status"`;EventType string `json:"event_type"`;Note string `json:"note"`};if !decodeJSON(w,r,&input){return}
	err:=s.admin.UpdateCase(r.Context(),strings.TrimSpace(r.PathValue("caseID")),actor,input.AssignedTo,input.Status,input.EventType,input.Note,clientIP(r.RemoteAddr),RequestIDFromContext(r.Context()))
	if err!=nil{s.writeAdminError(w,r,err);return};writeJSON(w,http.StatusOK,map[string]bool{"updated":true})
}

func (s *Server) adminCreateOrganizationGovernanceReview(w http.ResponseWriter,r *http.Request){
	actor,ok:=adminClaimsID(r);if !ok{writeError(w,r,http.StatusForbidden,"admin_forbidden","master admin access denied");return}
	var input admin.CreateOrganizationGovernanceInput;if !decodeJSON(w,r,&input){return}
	result,err:=s.admin.CreateOrganizationGovernanceReview(r.Context(),actor,input,clientIP(r.RemoteAddr),RequestIDFromContext(r.Context()))
	if err!=nil{s.writeAdminError(w,r,err);return};writeJSON(w,http.StatusCreated,result)
}
