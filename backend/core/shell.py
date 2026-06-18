"""
core/shell.py
Shared async wrapper for shelling out to external binaries.
"""
import asyncio
import logging

logger = logging.getLogger(__name__)


class ShellError(RuntimeError):
    """Raised when an external binary exits with a non-zero status."""

    def __init__(self, cmd: list[str], returncode: int, stderr: str):
        self.cmd = cmd
        self.returncode = returncode
        self.stderr = stderr
        snippet = stderr.strip().splitlines()[-1] if stderr.strip() else "(no output)"
        super().__init__(f"`{cmd[0]}` exited {returncode}: {snippet}")


async def run_subprocess(cmd: list[str], timeout: float = 120.0) -> tuple[bytes, bytes]:
    logger.info(f"Running: {' '.join(cmd)}")
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        raise RuntimeError(
            f"Required binary '{cmd[0]}' is not installed on this server."
        )

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise RuntimeError(f"'{cmd[0]}' timed out after {timeout:.0f}s.")

    if proc.returncode != 0:
        raise ShellError(cmd, proc.returncode, stderr.decode("utf-8", errors="replace"))

    return stdout, stderr