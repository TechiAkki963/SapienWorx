FROM clamav/clamav:1.4.6_base@sha256:90effb795234e6a93b070310a4bab5a58d93d94b9a077a09ce2229947679782b
RUN apk add --no-cache python3 py3-boto3
COPY clamd.conf /etc/clamav/clamd.conf
COPY runtime.py health.py /scanner/
ENTRYPOINT ["python3", "/scanner/runtime.py"]
