import asyncio
import json
import subprocess
import os

async def list_notebooks():
    server_path = os.path.expanduser("~/.local/bin/notebooklm-mcp")
    
    # Start the MCP server process
    process = await asyncio.create_subprocess_exec(
        server_path,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    async def send_msg(msg):
        process.stdin.write((json.dumps(msg) + "\n").encode())
        await process.stdin.drain()

    async def read_msg():
        line = await process.stdout.readline()
        if not line: return None
        return json.loads(line.decode())

    try:
        # 1. Initialize
        await send_msg({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0.0"}
            }
        })
        
        # Read init response (and potential logs/notifications)
        while True:
            resp = await read_msg()
            if not resp: break
            if resp.get("id") == 1:
                break

        # 2. Call notebook_list
        await send_msg({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "notebook_list",
                "arguments": {}
            }
        })

        # Read tool response
        while True:
            resp = await read_msg()
            if not resp: break
            if resp.get("id") == 2:
                result = resp.get("result", {})
                content = result.get("content", [])
                for item in content:
                    print(item.get("text", ""))
                break

    finally:
        process.terminate()
        await process.wait()

if __name__ == "__main__":
    asyncio.run(list_notebooks())
