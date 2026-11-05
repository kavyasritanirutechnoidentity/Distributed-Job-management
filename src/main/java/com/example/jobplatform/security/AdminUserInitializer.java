package com.example.jobplatform.security;

import com.example.jobplatform.entity.AppUser;
import com.example.jobplatform.entity.Role;
import com.example.jobplatform.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AdminUserInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminUserInitializer.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String adminUsername;
    private final String adminPassword;

    public AdminUserInitializer(
            UserRepository users,
            PasswordEncoder passwordEncoder,
            @Value("${security.admin.username:admin}") String adminUsername,
            @Value("${security.admin.password:admin123}") String adminPassword) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if ("admin123".equals(adminPassword)) {
            log.warn("The default admin password is in use. Set ADMIN_PASSWORD to a strong password "
                    + "before exposing this service.");
        }
        if (users.findByUsername(adminUsername).isPresent()) {
            return;
        }
        AppUser admin = new AppUser();
        admin.setUsername(adminUsername);
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        admin.setRole(Role.ADMIN);
        users.save(admin);
        log.info("Created initial ADMIN user '{}'. Set ADMIN_PASSWORD to change the default password.", adminUsername);
    }
}
