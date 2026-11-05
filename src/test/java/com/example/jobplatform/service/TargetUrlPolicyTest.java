package com.example.jobplatform.service;

import org.junit.jupiter.api.Test;

import java.net.InetAddress;

import static org.junit.jupiter.api.Assertions.*;

class TargetUrlPolicyTest {
    private final TargetUrlPolicy policy = new TargetUrlPolicy();

    @Test
    void rejectsNonPublicRangesAndUnsafeSchemes() {
        for (String url : new String[]{"http://127.0.0.1/", "http://10.0.0.1/", "http://172.16.0.1/",
                "http://192.168.0.1/", "http://169.254.169.254/", "http://100.64.0.1/",
                "http://0.0.0.0/", "http://[::1]/", "http://[fc00::1]/", "http://[fe80::1]/",
                "http://[::ffff:127.0.0.1]/", "ftp://8.8.8.8/", "file:///etc/hosts",
                "http://user:password@8.8.8.8/", "http://8.8.8.8/#fragment"}) {
            assertThrows(IllegalArgumentException.class, () -> policy.validate(url), url);
        }
    }

    @Test
    void acceptsPublicAddressWithoutSendingARequest() {
        assertEquals("8.8.8.8", policy.validate("https://8.8.8.8/").getHost());
    }

    @Test
    void rejectsDocumentationAndBenchmarkRanges() throws Exception {
        for (String address : new String[]{"192.0.2.1", "198.51.100.1", "203.0.113.1",
                "198.18.0.1", "224.0.0.1", "240.0.0.1", "2001:db8::1"}) {
            assertFalse(policy.isPublic(InetAddress.getByName(address)), address);
        }
    }
}
