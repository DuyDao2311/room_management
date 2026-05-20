class SuccessResponse {
    constructor({ message, statusCode = 200, reasonStatusCode = 'OK', metadata = {} }) {
        this.message = !message ? reasonStatusCode : message;
        this.status = statusCode;
        this.metadata = metadata;
    }

    send(res, headers = {}) {
        return res.status(this.status).json({
            message: this.message,
            metadata: this.metadata
        });
    }
}

class OK extends SuccessResponse {
    constructor({ message, metadata }) {
        super({ message, statusCode: 200, reasonStatusCode: 'OK', metadata });
    }
}

class Created extends SuccessResponse {
    constructor({ message, metadata }) {
        super({ message, statusCode: 201, reasonStatusCode: 'Created', metadata });
    }
}

module.exports = {
    OK,
    Created,
    SuccessResponse
};
