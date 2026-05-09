export class ActionRunReport {
  readonly warnings: string[] = []

  warn(message: string): void {
    this.warnings.push(message)
  }

  softFailure(message: string): void {
    this.warn(message)
  }

  toCheckSummary(): string {
    if (this.warnings.length === 0) {
      return 'OpenCHA completed without warnings.'
    }

    return [
      'OpenCHA completed with warnings:',
      '',
      ...this.warnings.map((warning) => `- ${warning}`)
    ].join('\n')
  }
}
