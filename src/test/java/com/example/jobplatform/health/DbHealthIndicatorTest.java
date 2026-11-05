package com.example.jobplatform.health;

import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Status;
import org.springframework.boot.actuate.jdbc.DataSourceHealthIndicator;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DbHealthIndicatorTest {

    private final DataSource dataSource = mock(DataSource.class);
    private final DataSourceHealthIndicator indicator = new DataSourceHealthIndicator(dataSource);

    @Test
    void upWhenConnectionSucceeds() throws SQLException {
        Connection conn = mock(Connection.class);
        java.sql.DatabaseMetaData meta = mock(java.sql.DatabaseMetaData.class);
        Statement stmt = mock(Statement.class);
        ResultSet rs = mock(ResultSet.class);
        java.sql.ResultSetMetaData rsMeta = mock(java.sql.ResultSetMetaData.class);
        when(dataSource.getConnection()).thenReturn(conn);
        when(conn.getMetaData()).thenReturn(meta);
        when(meta.getDatabaseProductName()).thenReturn("PostgreSQL");
        when(conn.createStatement()).thenReturn(stmt);
        when(stmt.executeQuery("SELECT 1")).thenReturn(rs);
        when(rs.getMetaData()).thenReturn(rsMeta);
        when(rsMeta.getColumnCount()).thenReturn(1);
        when(rsMeta.getColumnLabel(1)).thenReturn("1");
        when(rs.next()).thenReturn(true, false);
        when(conn.isValid(org.mockito.ArgumentMatchers.anyInt())).thenReturn(true);

        var health = indicator.health();
        assertEquals(Status.UP, health.getStatus(), () -> health.getDetails().toString());
    }

    @Test
    void downWhenDatabaseUnavailable() throws SQLException {
        when(dataSource.getConnection()).thenThrow(new SQLException("connection refused"));

        assertEquals(Status.DOWN, indicator.health().getStatus());
    }
}
