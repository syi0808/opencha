export class OpenchaError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hard = true
  ) {
    super(message)
    this.name = 'OpenchaError'
  }
}

export class ConfigError extends OpenchaError {
  constructor(message: string) {
    super(message, 'config_error', true)
    this.name = 'ConfigError'
  }
}

export class PayloadDecryptError extends OpenchaError {
  constructor(message = 'OpenCHA challenge state could not be decrypted or authenticated.') {
    super(message, 'payload_decrypt_error', true)
    this.name = 'PayloadDecryptError'
  }
}

export class StateRecordError extends OpenchaError {
  constructor(message: string) {
    super(message, 'state_record_error', true)
    this.name = 'StateRecordError'
  }
}

export class GitHubGatewayError extends OpenchaError {
  constructor(message: string, code = 'github_gateway_error', hard = true) {
    super(message, code, hard)
    this.name = 'GitHubGatewayError'
  }
}

export class NotFoundError extends GitHubGatewayError {
  constructor(message = 'GitHub resource was not found.') {
    super(message, 'not_found', true)
    this.name = 'NotFoundError'
  }
}

export class PermissionError extends GitHubGatewayError {
  constructor(message = 'GitHub token does not have permission for this operation.') {
    super(message, 'permission_error', true)
    this.name = 'PermissionError'
  }
}
