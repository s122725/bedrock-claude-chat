from typing import Any, Callable, Generic, TypeVar, get_args, get_origin

from app.bedrock import ConverseApiToolSpec
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class RunResult(BaseModel):
    succeeded: bool
    body: str


class InvalidToolError(Exception):
    pass


class AgentTool(Generic[T]):
    def __init__(
        self,
        name: str,
        description: str,
        args_schema: type[T],
        function: Callable[[T], str],
    ):
        self.name = name
        self.description = description
        self.args_schema = args_schema
        self.function = function

    def _generate_input_schema(self) -> dict[str, Any]:
        """Converts the Pydantic model to a JSON schema."""
        properties = {}
        required = []

        for name, field in self.args_schema.model_fields.items():
            field_type = get_origin(field.annotation)
            description = field.description

            if description is None:
                raise InvalidToolError("description is required")

            if field_type is list:
                item_type = (
                    "string"
                    if get_args(field.annotation)[0] == str
                    else get_args(field.annotation)[0].__name__.lower()
                )
                properties[name] = {
                    "type": "array",
                    "items": {"type": item_type},
                    "description": description,
                }
            else:
                if field.annotation == str:
                    field_type = "string"
                elif field.annotation == float:
                    field_type = "number"
                elif field.annotation == int:
                    field_type = "integer"
                else:
                    raise InvalidToolError(f"Unsupported type: {field.annotation}")

                properties[name] = {
                    "type": field_type,
                    "description": description,
                }

            if field.is_required():
                required.append(name)

        return {
            "type": "object",
            "properties": properties,
            "required": required,
        }

    def to_converse_spec(self) -> ConverseApiToolSpec:
        inputSchema = {"json": self._generate_input_schema()}

        return ConverseApiToolSpec(
            name=self.name, description=self.description, inputSchema=inputSchema
        )

    def run(self, arg: T) -> RunResult:
        try:
            res = self.function(arg)
            return RunResult(succeeded=True, body=res)
        except Exception as e:
            return RunResult(succeeded=False, body=str(e))
