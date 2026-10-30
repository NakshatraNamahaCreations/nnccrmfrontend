// Must match PROPOSAL_STATUSES in the backend Enquiry model
export const PROPOSAL_STATUS_META = {
  preparing:   { label: "Preparing",   cls: "enq-ps-preparing" },
  sent:        { label: "Sent",        cls: "enq-ps-sent" },
  negotiation: { label: "Negotiation", cls: "enq-ps-negotiation" },
  accepted:    { label: "Accepted",    cls: "enq-ps-accepted" },
  rejected:    { label: "Rejected",    cls: "enq-ps-rejected" },
};

export const proposalLabel = (s) => PROPOSAL_STATUS_META[s]?.label || s;
