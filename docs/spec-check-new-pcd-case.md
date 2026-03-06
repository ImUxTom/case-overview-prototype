# Spec: Check new PCD case task

- Decision
    - Reject
        - Reasons for rejection → Review task type → Case type
        - Police response date
        - Create reminder task
            - No → Check answers
            - Yes → Reminder due date → Check answers
    - Accept
        - Review task type → Case type
        - Transfer case
            - No
                - Early advice + RASSO → Task owner → Check answers
                - Early advice + not RASSO → Prosecutor → Check answers
                - Other review task type → Check answers
            - Yes → Area → Unit
                - Early advice + RASSO → Task owner → Check answers
                - Early advice + not RASSO → Prosecutor → Check answers
                - Other review task type → Check answers
