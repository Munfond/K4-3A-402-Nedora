import type { AllMiddlewareArgs, SlackViewMiddlewareArgs } from "@slack/bolt";
import { appUrl } from "@feedback/config/url";

import { slackAppFetch } from "~/lib/fetcher";

const feedbackViewCallback = async ({
  ack,
  view,
  body,
  logger,
}: AllMiddlewareArgs & SlackViewMiddlewareArgs) => {
  try {
    await ack();

    // Note: View submissions don't have direct channel access for ephemeral messages
    // The user will receive a DM when the workflow completes instead

    const {
      severity_block_id,
      account_id_block_id,
      opportunity_id_block_id,
      customer_pain_block_id,
      links_block_id,
    } = view.state.values;

    const severityValue =
      severity_block_id.severity_select_id.selected_option?.value || "";
    const accountId = account_id_block_id.account_id_input_id.value || "";
    const opportunityId =
      opportunity_id_block_id.opportunity_id_input_id?.value || "";
    const customerPain =
      customer_pain_block_id?.customer_pain_input_id?.value || "";
    const links = links_block_id?.links_input_id?.value || "";

    // Transform severity: nice_to_have -> low, significant_pain -> medium, dealbreaker -> high
    const severityMap: Record<string, string> = {
      nice_to_have: "low",
      significant_pain: "medium",
      dealbreaker: "high",
    };
    const severity = severityMap[severityValue] || severityValue;

    const feedbackData = {
      severity,
      accountId,
      opportunityId,
      customerPain,
      links: links
        .split(",")
        .map((link) => link.trim())
        .filter((link) => link.length > 0),
      submittedBy: body.user.id,
      submitterName: body.user.name,
      submittedAt: new Date().toISOString(),
    };

    // Log the feedback details
    logger.info("Feedback submitted:", feedbackData);

    console.log({ user: body.user });
    console.log("=== FEEDBACK SUBMISSION ===");
    console.log("Severity:", feedbackData.severity);
    console.log("Account ID:", feedbackData.accountId);
    console.log("Opportunity ID:", feedbackData.opportunityId);
    console.log("Customer Pain:", feedbackData.customerPain);
    console.log("Relevant Links:", feedbackData.links);
    console.log("Submitted by:", feedbackData.submittedBy);
    console.log("Submitter Name:", feedbackData.submitterName);
    console.log("Submitted at:", feedbackData.submittedAt);
    console.log("==========================");

    // Send POST request to the ingest API
    try {
      const response = await slackAppFetch(`${appUrl}/api/slack/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Failed to send feedback to ingest API: ${response.status} ${errorText}`,
        );
      } else {
        const result = await response.json();
        logger.info("Feedback successfully sent to ingest API:", result);
        // User will receive a DM when the workflow completes
      }
    } catch (fetchError) {
      logger.error("Error sending feedback to ingest API:", fetchError);
    }
  } catch (error) {
    logger.error("Feedback view submission handler failed:", error);
    throw error;
  }
};

export default feedbackViewCallback;
