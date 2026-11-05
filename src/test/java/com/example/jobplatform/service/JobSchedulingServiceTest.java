package com.example.jobplatform.service;

import com.example.jobplatform.config.TemporalProperties;
import com.example.jobplatform.entity.Job;
import io.temporal.client.schedules.Schedule;
import io.temporal.client.schedules.ScheduleAlreadyRunningException;
import io.temporal.client.schedules.ScheduleClient;
import io.temporal.client.schedules.ScheduleHandle;
import io.temporal.client.schedules.ScheduleOptions;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobSchedulingServiceTest {

    private final ScheduleClient client = mock(ScheduleClient.class);
    private final ScheduleHandle handle = mock(ScheduleHandle.class);
    private final JobSchedulingService service =
            new JobSchedulingService(client, new TemporalProperties("localhost:7233", "default", "queue"));

    private Job job(UUID id) {
        Job job = mock(Job.class);
        when(job.getId()).thenReturn(id);
        when(job.getTargetUrl()).thenReturn("https://example.com/health");
        when(job.getIntervalSeconds()).thenReturn(60L);
        when(job.isEnabled()).thenReturn(true);
        return job;
    }

    @Test
    void createsScheduleWhenNoneExists() {
        Job job = job(UUID.randomUUID());
        String scheduleId = service.createSchedule(job);
        assertEquals("job-" + job.getId(), scheduleId);
        verify(client).createSchedule(eq(scheduleId), any(Schedule.class), any(ScheduleOptions.class));
        verify(client, never()).getHandle(any());
    }

    @Test
    void updatesSpecInsteadOfSilentlyReusingWhenScheduleAlreadyExists() {
        Job job = job(UUID.randomUUID());
        doThrow(new ScheduleAlreadyRunningException(new RuntimeException("exists")))
                .when(client).createSchedule(any(), any(), any());
        when(client.getHandle(service.scheduleIdFor(job))).thenReturn(handle);

        String scheduleId = service.createSchedule(job);

        assertEquals("job-" + job.getId(), scheduleId);
        verify(client).getHandle("job-" + job.getId());
        verify(handle).update(any());
    }

    @Test
    void updateSchedulePushesSpecToExistingHandle() {
        Job job = job(UUID.randomUUID());
        when(client.getHandle(service.scheduleIdFor(job))).thenReturn(handle);
        service.updateSchedule(job);
        verify(handle).update(any());
    }

    @Test
    void deleteScheduleDeletesViaHandle() {
        when(client.getHandle("job-x")).thenReturn(handle);
        service.deleteSchedule("job-x");
        verify(handle).delete();
    }
}
