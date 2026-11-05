package com.example.jobplatform.exception;

import org.junit.jupiter.api.Test;
import org.springframework.web.bind.MissingServletRequestParameterException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void unexpectedExceptionReturns500WithoutInternalDetails() {
        var response = handler.handleUnexpected(new RuntimeException("sensitive internal detail"));

        assertEquals(500, response.getStatusCode().value());
        assertEquals("Unexpected server error", response.getBody().get("error"));
        assertFalse(response.getBody().get("error").contains("sensitive"));
    }

    @Test
    void missingParameterReturns400WithParameterName() {
        var response = handler.handleMissingParameter(
                new MissingServletRequestParameterException("size", "int"));

        assertEquals(400, response.getStatusCode().value());
        assertEquals("Missing required parameter: size", response.getBody().get("error"));
    }

    @Test
    void unknownPathReturns404() {
        var response = handler.handleUnknownPath();

        assertEquals(404, response.getStatusCode().value());
        assertEquals("Not found", response.getBody().get("error"));
    }
}
