class ErrorResponse extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

class BadRequestError extends ErrorResponse {
    constructor(message = 'Bad Request', statusCode = 400) {
        super(message, statusCode);
    }
}

class NotFoundError extends ErrorResponse {
    constructor(message = 'Not Found', statusCode = 404) {
        super(message, statusCode);
    }
}

module.exports = {
    ErrorResponse,
    BadRequestError,
    NotFoundError,
};
