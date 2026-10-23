package com.example.jobplatform.workflow;

import io.temporal.workflow.WorkflowInterface;
import io.temporal.workflow.WorkflowMethod;

@WorkflowInterface
public interface JobExecutionWorkflow {

    @WorkflowMethod
    String execute(JobExecutionRequest request);
}
