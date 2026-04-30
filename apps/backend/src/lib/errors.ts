export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class InvalidConfigError extends AppError {
  constructor(message: string) {
    super(message, 'INVALID_CONFIG', 400);
    this.name = 'InvalidConfigError';
  }
}
