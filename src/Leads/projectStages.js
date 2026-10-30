// Project delivery stages — must match PROJECT_STAGES in backend src/models/Lead.js.
// Separate from the sales `stage` (Lead Capture … Closed) used by pipeline/analytics.

export const PROJECT_STAGES = [
  "Onboarded",
  "Requirement Gathering",
  "Design",
  "Development in Progress",
  "Testing / Review",
  "Deployed / Live",
  "Project Completed",
  "On Hold",
];

export const PROJECT_STAGE_COLOR = {
  "":                        { bg: "#f1f5f9", color: "#64748b" },
  "Onboarded":               { bg: "#eaf1ff", color: "#2457e6" },
  "Requirement Gathering":   { bg: "#ecfeff", color: "#0e7490" },
  "Design":                  { bg: "#fdf2f8", color: "#be185d" },
  "Development in Progress": { bg: "#f2eaff", color: "#7c3aed" },
  "Testing / Review":        { bg: "#fff4df", color: "#de8a00" },
  "Deployed / Live":         { bg: "#e0f2fe", color: "#0369a1" },
  "Project Completed":       { bg: "#e7f7ef", color: "#0c9f61" },
  "On Hold":                 { bg: "#fee2e2", color: "#b91c1c" },
};

export const projectStageLabel = (s) => s || "Not Started";

// Form patch when the project stage changes, keeping the "Project Completed"
// checkbox and completion date in step (the backend applies the same rule)
export function projectStagePatch(form, stage) {
  const today = new Date().toISOString().slice(0, 10);
  const patch = { projectStage: stage };
  if (stage === "Project Completed") {
    patch.projectCompleted = true;
    if (!form.projectCompletionDate) patch.projectCompletionDate = today;
  } else if (form.projectStage === "Project Completed") {
    patch.projectCompleted = false;
  }
  if (stage && stage !== "On Hold" && !form.onboardedDate) patch.onboardedDate = today;
  return patch;
}
