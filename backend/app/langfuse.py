
import json
import os
import boto3
import logging
from dataclasses import dataclass
from datetime import datetime
from langchain_core.outputs import GenerationChunk
from langfuse import Langfuse
from langfuse.callback import CallbackHandler

logger = logging.getLogger(__name__)

@dataclass
class LangfuseSecrets:
    pub_key: str
    priv_key: str

def get_secrets() -> LangfuseSecrets:
    """Returns Langfuse secrets from AWS Secrets Manager.
    Returns:
        LangfuseSecrets: secrets for Langfuse
    """
    secret_arn = os.environ.get("LANGFUSE_SECRETS_ARN", None)
    if secret_arn is None:
        return None
    aws = boto3.Session(region_name=os.environ["AWS_REGION"])
    secretsmanager = aws.client("secretsmanager", region_name=os.environ["AWS_REGION"])
    resp = secretsmanager.get_secret_value(SecretId=secret_arn)
    secret = json.loads(resp["SecretString"])
    ret = LangfuseSecrets(
        pub_key=secret["LANGFUSE_PUBLIC_KEY"],
        priv_key=secret["LANGFUSE_SECRET_KEY"],
    )
    return ret

def setup_langfuse_env() -> bool:
    """Sets up Langfuse environment variables.
    See: https://langfuse.com/docs/sdk/python/low-level-sdk
    """
    secrets = get_secrets()
    if secrets is None:
        return False
    os.environ["LANGFUSE_PUBLIC_KEY"] = secrets.pub_key
    os.environ["LANGFUSE_SECRET_KEY"] = secrets.priv_key
    return True

def is_langfuse_debug_mode() -> bool:
    return os.environ.get("LANGFUSE_DEBUG", "false").lower() == "true"

def init_langfuse_client() -> Langfuse | None:
    if setup_langfuse_env():
        is_debug = is_langfuse_debug_mode()
        langfuse = Langfuse(debug=is_debug)
        return langfuse
    return None


def get_langfuse_callback_handler(trace_name: str, user_id: str, conversation_id: str) -> CallbackHandler | None:
    if langfuse_client is None:
        return None
    is_debug = is_langfuse_debug_mode()
    return CallbackHandler(debug=is_debug, trace_name=trace_name, user_id=user_id, session_id=conversation_id)


langfuse_client = init_langfuse_client()


class AnthropicStreamTracer:
    """This class is used for AnthropicStreamHandler in backend/app/stream.py"""

    def __init__(self) -> None:
        self.model = ""
        self.trace = None
        self.generation = None
        self.is_first_text: bool = True
        self.output_text : str = ""

    def on_start(self, args: dict, option:dict|None = None):
        if langfuse_client is None:
            return
        try:
            session_id = option["conversation_id"]
            user_id = option["user_id"] if option is not None else None

            # trace for Langfuse
            self.model = args["model"]
            self.trace = langfuse_client.trace(
                session_id = session_id,
                name = "chat",
                user_id = user_id,
                input={"messages":args["messages"]}, 
            )
            self.generation = self.trace.generation(            
                start_time=datetime.now(),
                model=self.model,
                model_parameters={
                    "max_tokens": args["max_tokens"],
                    "top_k": args["top_k"],
                    "top_p": args["top_p"],
                    "temperature": args["temperature"],
                },
            )
        except Exception as e:
            logger.error(f"Error in AnthropicStreamTracer.on_start: {e}")

    def on_stream(self, token: str, **kwargs) -> GenerationChunk:
        if langfuse_client is None:
            return
        try:
            # trace for Langfuse
            self.output_text += token
            self.trace.update(output={"output_text":self.output_text})
            if(self.is_first_text):
                self.is_first_text = False
                self.generation.update(completion_start_time=datetime.now())
        except Exception as e:
            logger.error(f"Error in AnthropicStreamTracer.on_stream: {e}")

    def on_stop(self, metrics: dict, price:float):
        if langfuse_client is None:
            return
        try:
            input_token_count = metrics.get("inputTokenCount")
            output_token_count = metrics.get("outputTokenCount")
            invocation_latency = metrics.get("invocationLatency")
            first_byte_latency = metrics.get("firstByteLatency")

            self.trace.update(
                metadata={
                    "model": self.model,
                    "invocation_latency": invocation_latency,
                    "first_byte_latency": first_byte_latency
                }
            )
            self.generation.update(
                end_time=datetime.now(),
                usage={
                    "input":input_token_count, 
                    "output":output_token_count, 
                    "total": input_token_count + output_token_count , 
                    "total_cost": price
                },
                metadata={
                    "invocation_latency": invocation_latency,
                    "first_byte_latency": first_byte_latency
                }
            )
            langfuse_client.flush()
        except Exception as e:
            logger.error(f"Error in AnthropicStreamTracer.on_stop: {e}")