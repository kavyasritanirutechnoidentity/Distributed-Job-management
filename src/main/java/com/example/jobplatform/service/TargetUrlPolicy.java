package com.example.jobplatform.service;

import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

@Component
public class TargetUrlPolicy {
    public URI validate(String targetUrl) {
        URI uri;
        try {
            uri = URI.create(targetUrl);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Target URL must be a valid public HTTP or HTTPS endpoint");
        }
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getRawUserInfo() != null || uri.getRawFragment() != null) {
            throw new IllegalArgumentException("Target URL must be a public HTTP or HTTPS endpoint without credentials or fragments");
        }
        String host = uri.getHost().toLowerCase();
        boolean ipLiteral = host.matches("[0-9.]+") || host.indexOf(':') >= 0;
        if (host.equals("localhost") || host.endsWith(".localhost") || host.endsWith(".local")
                || host.endsWith(".internal") || host.endsWith(".lan") || host.endsWith(".home")
                || host.endsWith(".corp") || (!ipLiteral && !host.contains("."))) {
            throw new IllegalArgumentException("Target URL must resolve only to public internet addresses");
        }
        try {
            resolvePublicHost(host);
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException(e instanceof NonPublicAddressException
                    ? "Target URL must resolve only to public internet addresses"
                    : "Target URL hostname could not be resolved");
        }
        return uri;
    }

    public InetAddress[] resolvePublicHost(String host) throws UnknownHostException {
        InetAddress[] addresses = InetAddress.getAllByName(host);
        for (InetAddress address : addresses) {
            if (!isPublic(address)) {
                throw new NonPublicAddressException();
            }
        }
        return addresses;
    }

    private static final class NonPublicAddressException extends UnknownHostException {
        NonPublicAddressException() {
            super("Target must resolve only to public internet addresses");
        }
    }

    boolean isPublic(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) return false;
        byte[] bytes = address.getAddress();
        if (bytes.length == 16) {
            int first = bytes[0] & 255;
            int second = bytes[1] & 255;
            int third = bytes[2] & 255;
            int fourth = bytes[3] & 255;
            return (first & 0xe0) == 0x20
                    && !(first == 0x20 && second == 0x01 && third <= 1)
                    && !(first == 0x20 && second == 0x01 && third == 0x0d && fourth == 0xb8)
                    && !(first == 0x20 && second == 0x02)
                    && !(first == 0x3f && second == 0xff);
        }
        int a = bytes[0] & 255;
        int b = bytes[1] & 255;
        int c = bytes[2] & 255;
        return a != 0 && a != 10 && a != 127 && a < 224
                && !(a == 100 && b >= 64 && b <= 127)
                && !(a == 169 && b == 254) && !(a == 172 && b >= 16 && b <= 31)
                && !(a == 192 && (b == 168 || b == 0 || b == 88 && c == 99))
                && !(a == 198 && (b == 18 || b == 19 || b == 51 && c == 100))
                && !(a == 203 && b == 0 && c == 113);
    }
}
