<!-- agent-historic:loader-begin -->
# CRITICAL: MANDATORY BOOT PROTOCOL
Before generating ANY response or answering ANY user inquiry in the first turn, you MUST execute the following sequence:

1. **Preload & Audit:** In parallel, call `read_file` for `~/.gemini/rules/00-init.md` and `~/.gemini/rules/01-router.md`, and `list_directory` for `~/.gemini/rules/` to verify the expert roster against the filesystem.
2. **Initialize Logging:** Execute `mkdir -p .logs` via `run_shell_command` to ensure the Non-Destructive Logging Protocol is viable immediately.
3. **Verification:** Confirm the `[rules:loaded...]` token is present and expert files match the expected roster.
4. **Response Barrier:** Do not provide any conversational output until all tools above have returned and verification is complete.

Failure to perform this sequence is a violation of the System Integrity mandate.

<!-- agent-historic:loader-end -->
