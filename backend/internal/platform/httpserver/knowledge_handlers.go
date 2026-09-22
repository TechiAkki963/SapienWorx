package httpserver

import (
 "errors"
 "net/http"
 "strings"

 "github.com/TechiAkki963/SapienWorx/backend/internal/admin"
)

func (s *Server) knowledgeIndex(w http.ResponseWriter,r *http.Request){
 if s.admin==nil {writeError(w,r,http.StatusServiceUnavailable,"unavailable","knowledge hub is unavailable");return}
 result,err:=s.admin.PublishedKnowledge(r.Context(),r.URL.Query().Get("category"))
 if err!=nil{s.writeKnowledgeError(w,r,err);return}
 writeJSON(w,http.StatusOK,result)
}

func (s *Server) knowledgeArticle(w http.ResponseWriter,r *http.Request){
 if s.admin==nil {writeError(w,r,http.StatusServiceUnavailable,"unavailable","knowledge hub is unavailable");return}
 result,err:=s.admin.PublishedKnowledgeArticle(r.Context(),r.PathValue("slug"))
 if err!=nil{s.writeKnowledgeError(w,r,err);return}
 writeJSON(w,http.StatusOK,result)
}

func (s *Server) adminKnowledge(w http.ResponseWriter,r *http.Request){
 if r.Method==http.MethodGet {
  result,err:=s.admin.AllKnowledge(r.Context())
  if err!=nil{s.writeKnowledgeError(w,r,err);return}
  writeJSON(w,http.StatusOK,result)
  return
 }
 adminID,ok:=adminClaimsID(r)
 if !ok {writeError(w,r,http.StatusForbidden,"admin_forbidden","master admin access denied");return}
 var input admin.KnowledgeInput
 if !decodeJSON(w,r,&input){return}
 a,err:=s.admin.CreateKnowledge(r.Context(),input,adminID,clientIP(r.RemoteAddr),RequestIDFromContext(r.Context()))
 if err!=nil{s.writeKnowledgeError(w,r,err);return}
 writeJSON(w,http.StatusCreated,a)
}

func (s *Server) adminKnowledgeArticle(w http.ResponseWriter,r *http.Request){
 adminID,ok:=adminClaimsID(r)
 if !ok {writeError(w,r,http.StatusForbidden,"admin_forbidden","master admin access denied");return}
 id:=strings.TrimSpace(r.PathValue("articleID"))
 if id=="" {writeError(w,r,http.StatusBadRequest,"invalid_request","article ID is required");return}
 var input admin.KnowledgeInput
 if !decodeJSON(w,r,&input){return}
 a,err:=s.admin.UpdateKnowledge(r.Context(),id,input,adminID,clientIP(r.RemoteAddr),RequestIDFromContext(r.Context()))
 if err!=nil{s.writeKnowledgeError(w,r,err);return}
 writeJSON(w,http.StatusOK,a)
}

func (s *Server) writeKnowledgeError(w http.ResponseWriter,r *http.Request,err error){
 switch {
 case errors.Is(err,admin.ErrNotFound):
  writeError(w,r,http.StatusNotFound,"not_found","article not found")
 case errors.Is(err,admin.ErrKnowledgeConflict):
  writeError(w,r,http.StatusConflict,"revision_conflict","this article has changed; reload before saving")
 case errors.Is(err,admin.ErrInvalid):
  writeError(w,r,http.StatusBadRequest,"invalid_article","check the article fields, image and category")
 default:
  s.logger.Error("knowledge hub operation failed","error",err,"request_id",RequestIDFromContext(r.Context()))
  writeError(w,r,http.StatusInternalServerError,"internal_error","article request could not be completed")
 }
}
