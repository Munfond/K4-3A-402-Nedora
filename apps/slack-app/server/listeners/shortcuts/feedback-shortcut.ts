import type {
  AllMiddlewareArgs,
  SlackShortcutMiddlewareArgs,
} from "@slack/bolt";

const feedbackShortcutCallback = async ({
  shortcut,
  ack,
  client,
  logger,
}: AllMiddlewareArgs & SlackShortcutMiddlewareArgs) => {
  try {
    const { trigger_id } = shortcut;

    await ack();
    await client.views.open({
      trigger_id,
      view: {
        type: "modal",
        callback_id: "feedback_view_id",
        title: {
          type: "plain_text",
          text: "Add Feedback",
        },
        blocks: [
          {
            type: "input",
            block_id: "severity_block_id",
            label: {
              type: "plain_text",
              text: "Severity",
            },
            element: {
              type: "static_select",
              action_id: "severity_select_id",
              placeholder: {
                type: "plain_text",
                text: "Select severity",
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "Nice to have",
                  },
                  value: "nice_to_have",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Significant pain",
                  },
                  value: "significant_pain",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Dealbreaker",
                  },
                  value: "dealbreaker",
                },
              ],
            },
            optional: false,
          },
          {
            type: "input",
            block_id: "account_id_block_id",
            label: {
              type: "plain_text",
              text: "Account ID",
            },
            element: {
              type: "plain_text_input",
              action_id: "account_id_input_id",
              placeholder: {
                type: "plain_text",
                text: "Enter Account ID",
              },
            },
            optional: false,
          },
          {
            type: "input",
            block_id: "opportunity_id_block_id",
            label: {
              type: "plain_text",
              text: "Opportunity ID",
            },
            element: {
              type: "plain_text_input",
              action_id: "opportunity_id_input_id",
              placeholder: {
                type: "plain_text",
                text: "Enter Opportunity ID",
              },
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "customer_pain_block_id",
            label: {
              type: "plain_text",
              text: "Customer Pain",
            },
            element: {
              type: "plain_text_input",
              action_id: "customer_pain_input_id",
              placeholder: {
                type: "plain_text",
                text: "What customer pain does this solve, and what outcome does it enable?",
              },
              multiline: true,
            },
            optional: false,
          },
          {
            type: "input",
            block_id: "links_block_id",
            label: {
              type: "plain_text",
              text: "Relevant Links",
            },
            hint: {
              type: "plain_text",
              text: "Comma-separated list of relevant links",
            },
            element: {
              type: "plain_text_input",
              action_id: "links_input_id",
              placeholder: {
                type: "plain_text",
                text: "https://example.com, https://another.com",
              },
              multiline: false,
            },
            optional: true,
          },
        ],
        submit: {
          type: "plain_text",
          text: "Add Feedback",
        },
        close: {
          type: "plain_text",
          text: "Cancel",
        },
      },
    });
  } catch (error) {
    logger.error("Feedback shortcut handler failed:", error);
  }
};

export default feedbackShortcutCallback;
