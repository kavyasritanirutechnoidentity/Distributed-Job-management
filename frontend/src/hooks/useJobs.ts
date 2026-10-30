import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getJob, getJobs, registerJob, scheduleJob } from "@/lib/api";
import { jobSchema, type JobRegistrationValues } from "@/lib/schemas";

const jobListSchema = z.array(jobSchema);

export const jobKeys = {
  all: ["jobs"] as const,
  detail: (id: string) => ["jobs", id] as const,
};

export function useJobs() {
  return useQuery({
    queryKey: jobKeys.all,
    queryFn: async () => jobListSchema.parse(await getJobs()),
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
