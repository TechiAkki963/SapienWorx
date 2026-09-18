FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/sapienworx-api ./cmd/api

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata wget \
    && addgroup -S sapienworx \
    && adduser -S -G sapienworx -H -s /sbin/nologin sapienworx
COPY --from=builder /out/sapienworx-api /usr/local/bin/sapienworx-api
USER sapienworx
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/health/live >/dev/null || exit 1
ENTRYPOINT ["/usr/local/bin/sapienworx-api"]
