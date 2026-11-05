package com.example.jobplatform.repository;

import com.example.jobplatform.entity.Job;
import com.example.jobplatform.entity.ScheduleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface JobRepository extends JpaRepository<Job, UUID>, JpaSpecificationExecutor<Job> {
    @Query(value = "SELECT EXISTS (SELECT 1 FROM jobs WHERE name = :name "
            + "AND md5(target_url) = md5(:url) AND target_url = :url)", nativeQuery = true)
    boolean existsByNameAndTargetUrl(@Param("name") String name, @Param("url") String targetUrl);

    @Query(value = "SELECT EXISTS (SELECT 1 FROM jobs WHERE name = :name "
            + "AND md5(target_url) = md5(:url) AND target_url = :url AND id <> :id)", nativeQuery = true)
    boolean existsByNameAndTargetUrlAndIdNot(@Param("name") String name, @Param("url") String targetUrl,
            @Param("id") UUID id);

    @Query(value = "SELECT CAST(pg_advisory_xact_lock(hashtext(:name), hashtext(:url)) AS text)", nativeQuery = true)
    String lockRegistration(@Param("name") String name, @Param("url") String url);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.QueryHints(
            @jakarta.persistence.QueryHint(name = "jakarta.persistence.lock.timeout", value = "5000"))
    @Query("select job from Job job where job.id = :id")
    java.util.Optional<Job> findByIdForUpdate(@Param("id") UUID id);

    long countByScheduleStatus(ScheduleStatus status);

    long countByEnabledTrue();
}
