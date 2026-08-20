import { jsPDF } from "jspdf";

export type CandidateProfilePdf = {
  name: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  noticePeriod: string;
  overallExperience: string;
  relevantExperience: string;
  skills: { name: string; rating: number }[];
  links: { label: string; value: string }[];
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 48;
const contentWidth = pageWidth - margin * 2;

function printable(value: string) {
  return value.replace(/[\u2013\u2014]/g, "-").replace(/\u00b7/g, "/").replace(/[^\x20-\x7E]/g, "");
}

function fileName(value: string) {
  return printable(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "candidate";
}

export function createCandidateProfilePdf(profile: CandidateProfilePdf) {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  let y = 0;

  const footer = (page: number) => {
    pdf.setDrawColor(222, 230, 241);
    pdf.line(margin, pageHeight - 42, pageWidth - margin, pageHeight - 42);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(102, 119, 141);
    pdf.text("Sapienworx candidate profile - shared at the candidate's discretion", margin, pageHeight - 27);
    pdf.text(`Page ${page}`, pageWidth - margin, pageHeight - 27, { align: "right" });
  };

  const newPage = (page: number) => {
    if (page > 1) pdf.addPage();
    pdf.setFillColor(14, 43, 82);
    pdf.rect(0, 0, pageWidth, 76, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.text("SAPIENWORX", margin, 31);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(201, 220, 247);
    pdf.text(page === 1 ? "CANDIDATE PROFILE" : "CANDIDATE PROFILE (CONTINUED)", margin, 49);
    y = 108;
    footer(page);
  };

  let currentPage = 1;
  newPage(currentPage);

  const ensureSpace = (height: number) => {
    if (y + height < pageHeight - 60) return;
    currentPage += 1;
    newPage(currentPage);
  };

  const heading = (label: string) => {
    ensureSpace(32);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(36, 87, 164);
    pdf.text(label, margin, y);
    y += 15;
    pdf.setDrawColor(218, 228, 240);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 15;
  };

  const paragraph = (text: string, options: { size?: number; color?: [number, number, number]; leading?: number; indent?: number } = {}) => {
    const size = options.size ?? 10;
    const leading = options.leading ?? size * 1.45;
    const indent = options.indent ?? 0;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? [62, 79, 103]));
    const lines = pdf.splitTextToSize(printable(text), contentWidth - indent);
    ensureSpace(lines.length * leading + 6);
    pdf.text(lines, margin + indent, y, { lineHeightFactor: leading / size });
    y += lines.length * leading + 6;
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(26);
  pdf.setTextColor(25, 47, 76);
  pdf.text(printable(profile.name), margin, y);
  y += 22;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(69, 91, 122);
  pdf.text(printable(`${profile.headline} | ${profile.location}`), margin, y);
  y += 28;

  pdf.setFillColor(244, 248, 255);
  pdf.setDrawColor(216, 228, 244);
  pdf.roundedRect(margin, y, contentWidth, 55, 6, 6, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(93, 111, 137);
  pdf.text("CONTACT", margin + 13, y + 18);
  pdf.text("EXPERIENCE", margin + 204, y + 18);
  pdf.text("NOTICE PERIOD", margin + 367, y + 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(40, 58, 83);
  pdf.text(printable(`${profile.email} | ${profile.phone}`), margin + 13, y + 36);
  pdf.text(printable(`${profile.overallExperience} overall | ${profile.relevantExperience} relevant`), margin + 204, y + 36);
  pdf.text(printable(profile.noticePeriod), margin + 367, y + 36);
  y += 82;

  heading("PROFILE SUMMARY");
  paragraph("Candidate profile prepared through Sapienworx. This copy reflects the information the candidate has chosen to share for their professional applications.");

  heading("WORK EXPERIENCE");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(35, 53, 77);
  ensureSpace(45);
  pdf.text("Senior Product Designer", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(89, 107, 132);
  pdf.text("Northstar Labs | January 2022 - Present", margin, y + 14);
  y += 30;
  paragraph("Leading end-to-end design for an analytics platform used by more than 20,000 customers. Own research, product strategy and the core design system.", { size: 9 });
  ensureSpace(45);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(35, 53, 77);
  pdf.text("Product Designer", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(89, 107, 132);
  pdf.text("Halcyon Studio | June 2019 - December 2021", margin, y + 14);
  y += 30;
  paragraph("Designed B2B workflows and a scalable interface library for enterprise teams, partnering with product managers and engineers.", { size: 9 });

  heading("EDUCATION & CERTIFICATIONS");
  paragraph("BA Interaction Design - University of the Arts London (2016 - 2019), First class", { size: 9 });
  paragraph("UX Management - Interaction Design Foundation (Issued 2023)", { size: 9 });
  paragraph("Google Analytics Certification - Google (Issued 2024)", { size: 9 });

  heading("SKILLS & RATINGS");
  paragraph(profile.skills.map((skill) => `${skill.name} (${skill.rating}/5)`).join("  |  "), { size: 9 });

  heading("PROJECTS & WORK LINKS");
  profile.links.forEach((link) => paragraph(`${link.label}: ${link.value}`, { size: 9 }));

  return pdf;
}

export function downloadCandidateProfilePdf(profile: CandidateProfilePdf) {
  const pdf = createCandidateProfilePdf(profile);
  pdf.save(`${fileName(profile.name)}-sapienworx-profile.pdf`);
}
