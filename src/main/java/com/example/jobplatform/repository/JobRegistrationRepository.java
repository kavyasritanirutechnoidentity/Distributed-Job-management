package com.example.jobplatform.repository;

import com.example.jobplatform.entity.JobRegistration;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface JobRegistrationRepository extends JpaRepository<JobRegistration, String> {

    @Modifying
    @Query(value = """
            INSERT INTO job_registrations (idempotency_key, request_payload)
            VALUES (:key, :payload)
            ON CONFLICT (idempotency_key) DO NOTHING
            """, nativeQuery = true)
    int reserve(@Param("key") String key, @Param("payload") String payload);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select registration from JobRegistration registration where registration.idempotencyKey = :key")
    Optional<JobRegistration> findByKeyForUpdate(@Param("key") String key);
}
