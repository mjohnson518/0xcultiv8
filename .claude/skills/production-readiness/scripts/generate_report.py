#!/usr/bin/env python3
"""
Report Generator - Generate production readiness reports in various formats
"""

import json
import argparse
from pathlib import Path
from datetime import datetime


def generate_markdown_report(report: dict) -> str:
    """Generate a comprehensive markdown report."""
    lines = []
    
    # Header
    lines.append("# Production Readiness Assessment Report\n")
    lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    lines.append(f"**Repository:** {report.get('metadata', {}).get('repository', 'Unknown')}\n")
    
    # Executive Summary
    lines.append("\n## Executive Summary\n")
    summary = report.get('executive_summary', {})
    
    score = summary.get('overall_score', 0)
    level = summary.get('readiness_level', 'Unknown')
    
    # Score badge
    if score >= 90:
        badge = "🟢"
    elif score >= 75:
        badge = "🟡"
    elif score >= 50:
        badge = "🟠"
    else:
        badge = "🔴"
    
    lines.append(f"### Overall Score: {badge} {score}/100\n")
    lines.append(f"**Readiness Level:** {level}\n")
    lines.append(f"\n**Recommendation:** {summary.get('recommendation', '')}\n")
    
    # Findings Summary Table
    lines.append("\n### Findings Summary\n")
    lines.append("| Severity | Count |")
    lines.append("|----------|-------|")
    lines.append(f"| 🔴 Critical | {summary.get('critical_count', 0)} |")
    lines.append(f"| 🟠 High | {summary.get('high_count', 0)} |")
    lines.append(f"| 🟡 Medium | {summary.get('medium_count', 0)} |")
    lines.append(f"| 🔵 Low | {summary.get('low_count', 0)} |")
    lines.append(f"| **Total** | **{summary.get('total_findings', 0)}** |")
    lines.append(f"\n**Estimated Remediation Effort:** {summary.get('estimated_remediation_hours', 0)} hours\n")
    
    # Technology Stack
    tech_stack = report.get('technology_stack', {})
    if tech_stack:
        lines.append("\n## Technology Stack\n")
        for category, techs in tech_stack.items():
            if techs:
                lines.append(f"- **{category.title()}:** {', '.join(techs)}")
        lines.append("")
    
    # Dimension Scores
    lines.append("\n## Dimension Scores\n")
    lines.append("| Dimension | Score | Weight | Findings |")
    lines.append("|-----------|-------|--------|----------|")
    
    dimension_scores = report.get('dimension_scores', {})
    for dim, data in sorted(dimension_scores.items(), key=lambda x: x[1].get('score', 0)):
        score = data.get('score', 0)
        if score >= 80:
            emoji = "🟢"
        elif score >= 60:
            emoji = "🟡"
        elif score >= 40:
            emoji = "🟠"
        else:
            emoji = "🔴"
        
        dim_name = dim.replace('_', ' ').title()
        lines.append(f"| {dim_name} | {emoji} {score}/100 | {data.get('weight', 1)} | {data.get('finding_count', 0)} |")
    
    lines.append("")
    
    # Critical Issues
    findings = report.get('findings', {})
    critical = findings.get('critical', [])
    
    if critical:
        lines.append("\n## 🔴 Critical Issues (Immediate Action Required)\n")
        for i, finding in enumerate(critical, 1):
            lines.append(f"### {i}. {finding.get('title', 'Unknown Issue')}\n")
            lines.append(f"**Location:** `{finding.get('location', 'Unknown')}`\n")
            lines.append(f"**Impact:** {finding.get('impact', '')}\n")
            lines.append(f"**Root Cause:** {finding.get('root_cause', '')}\n")
            lines.append(f"\n**Remediation:**\n{finding.get('remediation', '')}\n")
            lines.append(f"\n**Validation:**\n{finding.get('validation', '')}\n")
            lines.append(f"\n**Effort:** {finding.get('effort_hours', 0)} hours\n")
            lines.append("---\n")
    
    # High Priority Issues
    high = findings.get('high', [])
    
    if high:
        lines.append("\n## 🟠 High Priority Issues (Address Before Production)\n")
        for i, finding in enumerate(high, 1):
            lines.append(f"### {i}. {finding.get('title', 'Unknown Issue')}\n")
            lines.append(f"**Location:** `{finding.get('location', 'Unknown')}`\n")
            lines.append(f"**Impact:** {finding.get('impact', '')}\n")
            lines.append(f"\n**Remediation:** {finding.get('remediation', '')}\n")
            lines.append(f"\n**Effort:** {finding.get('effort_hours', 0)} hours\n")
            lines.append("---\n")
    
    # Medium Priority Issues (Summary)
    medium = findings.get('medium', [])
    
    if medium:
        lines.append("\n## 🟡 Medium Priority Issues\n")
        lines.append("| Issue | Location | Effort |")
        lines.append("|-------|----------|--------|")
        for finding in medium:
            lines.append(f"| {finding.get('title', '')} | `{finding.get('location', '')}` | {finding.get('effort_hours', 0)}h |")
        lines.append("")
    
    # Low Priority Issues (Summary)
    low = findings.get('low', [])
    
    if low:
        lines.append("\n## 🔵 Low Priority Issues (Technical Debt)\n")
        lines.append("| Issue | Location |")
        lines.append("|-------|----------|")
        for finding in low:
            lines.append(f"| {finding.get('title', '')} | `{finding.get('location', '')}` |")
        lines.append("")
    
    # Remediation Roadmap
    roadmap = report.get('remediation_roadmap', [])
    
    if roadmap:
        lines.append("\n## Remediation Roadmap\n")
        for phase in roadmap:
            lines.append(f"### Phase {phase.get('phase', '?')}: {phase.get('name', '')} ({phase.get('duration', '')})\n")
            for item in phase.get('items', []):
                lines.append(f"- [ ] {item}")
            lines.append("")
    
    # Dimension Details
    lines.append("\n## Dimension Details\n")
    for dim, data in dimension_scores.items():
        dim_name = dim.replace('_', ' ').title()
        lines.append(f"### {dim_name}\n")
        lines.append(f"**Score:** {data.get('score', 0)}/100\n")
        lines.append(f"\n{data.get('summary', '')}\n")
        
        recommendations = data.get('recommendations', [])
        if recommendations:
            lines.append("\n**Recommendations:**")
            for rec in recommendations[:3]:
                lines.append(f"- {rec}")
        lines.append("")
    
    # Footer
    lines.append("\n---\n")
    lines.append("*Report generated by Production Readiness Assessment System*\n")
    lines.append(f"*Assessment Duration: {report.get('metadata', {}).get('duration_seconds', 0):.1f} seconds*\n")
    
    return '\n'.join(lines)


def generate_html_report(report: dict) -> str:
    """Generate an HTML report."""
    markdown = generate_markdown_report(report)
    
    # Simple markdown to HTML conversion
    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Production Readiness Report</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
               max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }}
        h1, h2, h3 {{ color: #333; }}
        table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background-color: #f5f5f5; }}
        code {{ background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px; }}
        .critical {{ color: #dc3545; }}
        .high {{ color: #fd7e14; }}
        .medium {{ color: #ffc107; }}
        .low {{ color: #0dcaf0; }}
        hr {{ border: none; border-top: 1px solid #ddd; margin: 30px 0; }}
    </style>
</head>
<body>
<pre style="white-space: pre-wrap;">{markdown}</pre>
</body>
</html>"""
    
    return html


def main():
    parser = argparse.ArgumentParser(description="Generate production readiness reports")
    parser.add_argument("input", help="Input JSON report file")
    parser.add_argument("--output", "-o", help="Output file")
    parser.add_argument("--format", "-f", choices=["markdown", "html", "json"], 
                       default="markdown", help="Output format")
    
    args = parser.parse_args()
    
    # Load input report
    with open(args.input, 'r') as f:
        report = json.load(f)
    
    # Generate report
    if args.format == "markdown":
        output = generate_markdown_report(report)
        ext = ".md"
    elif args.format == "html":
        output = generate_html_report(report)
        ext = ".html"
    else:
        output = json.dumps(report, indent=2)
        ext = ".json"
    
    # Write output
    if args.output:
        output_path = args.output
    else:
        output_path = Path(args.input).stem + f"_report{ext}"
    
    with open(output_path, 'w') as f:
        f.write(output)
    
    print(f"Report generated: {output_path}")


if __name__ == "__main__":
    main()
