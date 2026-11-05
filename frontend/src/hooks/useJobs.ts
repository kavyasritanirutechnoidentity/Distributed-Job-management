import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getDashboard, getJob, getJobExecutions, getJobs, registerJob, scheduleJob, type JobListParams } from "@/lib/api";
import { dashboardSchema, jobPageSchema, jobExecutionSchema, jobSchema, type JobRegistrationValues } from "@/lib/schemas";

export const jobKeys = {
  all: ["jobs"] as const,
  detail: (id: string) => ["jobs", id] as const,
  executions: (id: string) => ["jobs", id, "executions"] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: [...jobKeys.all, "dashboard"],
    queryFn: async () => dashboardSchema.parse(await getDashboard()),
    refetchInterval: 15_000,
  });
}

export function useJobs(params: JobListParams = {}) {
  return useQuery({
    queryKey: [...jobKeys.all, "list", params],
    queryFn: async () => jobPageSchema.parse(await getJobs(params)),
    refetchInterval: 15_000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: async () => jobSchema.parse(await getJob(id)),
    refetchInterval: 10_000,
  });
}

export function useJobExecutions(id: string) {
  return useQuery({
    queryKey: jobKeys.executions(id),
    queryFn: async () => z.array(jobExecutionSchema).parse(await getJobExecutions(id)),
    refetchInterval: 10_000,
  });
}

export function useRegisterJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      values,
      idempotencyKey,
    }: {
      values: JobRegistrationValues;
      idempotencyKey: string;
    }) => registerJob(values, idempotencyKey).then(jobSchema.parse),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  });
}

export function useScheduleJob(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => scheduleJob(id).then(jobSchema.parse),
    onSuccess: (job) => {
      queryClient.setQueryData(jobKeys.detail(id), job);
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}
