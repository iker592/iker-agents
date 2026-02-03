FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.13-slim

# Build version to bust cache
ARG BUILD_VERSION=3

WORKDIR /app

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY server.py .

# Create non-root user for AgentCore
RUN useradd -m -u 1000 bedrock_agentcore
USER bedrock_agentcore

# AgentCore expects port 8080
EXPOSE 8080

# Run the MCP server with OpenTelemetry instrumentation
CMD ["opentelemetry-instrument", "python", "server.py"]
