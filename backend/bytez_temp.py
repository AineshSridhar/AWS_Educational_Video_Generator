"""
  pip i bytez
"""
import os
from bytez import Bytez
from dotenv import load_dotenv
load_dotenv()
BYTEZ_API_KEY = os.getenv("BYTEZ_API_KEY")  # optional
sdk = Bytez(BYTEZ_API_KEY)

# choose dreamlike-photoreal-2.0
model = sdk.model("dreamlike-art/dreamlike-photoreal-2.0")

# send input to model
res= model.run("A cat in a wizard hat")

print(res)
print(type(res))