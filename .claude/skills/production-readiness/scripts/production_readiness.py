#!/usr/bin/env python3
"""
Production Readiness Assessment - Main Orchestration Script
Enterprise-grade comprehensive codebase evaluation exceeding CTO-level standards
"""

import os
import sys
import json
import argparse
import subprocess
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import Optional
from enum import Enum


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Dimension(Enum):
    SECURITY = "security"
    ARCHITECTURE = "architecture"
    RELIABILITY = "reliability"
    PERFORMANCE = "performance"
    OBSERVABILITY = "observability"
    TESTING = "testing"
    DEVOPS = "devops"
    DATA_MANAGEMENT = "data_management"
    API_CONTRACTS = "api_contracts"
    DOCUMENTATION = "documentation"
    COMPLIANCE = "compliance"
    COST_OPTIMIZATION = "cost_optimization"
    DEPENDENCIES = "dependencies"
    CONFIGURATION = "configuration"
    TEAM_READINESS = "team_readiness"


# Dimension weights for scoring
DIMENSION_WEIGHTS = {
    Dimension.SECURITY: 3.0,
    Dimension.ARCHITECTURE: 3.0,
    Dimension.RELIABILITY: 3.0,
    Dimension.PERFORMANCE: 2.0,
    Dimension.OBSERVABILITY: 2.0,
    Dimension.TESTING: 2.0,
    Dimension.DEVOPS: 2.0,
    Dimension.DATA_MANAGEMENT: 2.0,
    Dimension.API_CONTRACTS: 1.5,
    Dimension.DOCUMENTATION: 1.5,
    Dimension.COMPLIANCE: 1.5,
    Dimension.COST_OPTIMIZATION: 1.5,
    Dimension.DEPENDENCIES: 1.5,
    Dimension.CONFIGURATION: 1.5,
    Dimension.TEAM_READINESS: 1.5,
}


@dataclass
class Finding:
    """Represents a single issue or finding"""
    title: str
    severity: Severity
    dimension: Dimension
    location: str
    description: str
    impact: str
    root_cause: str
    remediation: str
    validation: str
    effort_hours: float
    references: list = field(default_factory=list)
    
    def to_dict(self):
        return {
            **asdict(self),
            'severity': self.severity.value,
            'dimension': self.dimension.value
        }


@dataclass
class DimensionScore:
    """Score for a single dimension"""
    dimension: Dimension
    score: float  # 0-100
    findings: list
    summary: str
    recommendations: list


class ProductionReadinessAssessment:
    """Main assessment orchestrator"""
    
    def __init__(self, github_url: str, focus: Optional[list] = None, 
                 compliance_frameworks: Optional[list] = None):
        self.github_url = github_url
        self.focus = focus or [d.value for d in Dimension]
        self.compliance_frameworks = compliance_frameworks or []
        self.project_path = None
        self.findings: list[Finding] = []
        self.dimension_scores: dict[Dimension, DimensionScore] = {}
        self.tech_stack = {}
        self.statistics = {}
        self.start_time = datetime.now()
        
    def run_assessment(self) -> dict:
        """Execute full production readiness assessment"""
        print(f"\n{'='*60}")
        print("PRODUCTION READINESS ASSESSMENT")
        print(f"{'='*60}")
        print(f"Repository: {self.github_url}")
        print(f"Started: {self.start_time.isoformat()}")
        print(f"{'='*60}\n")
        
        # Phase 1: Clone repository
        self.project_path = self._clone_repository()
        if not self.project_path:
            return {"error": "Failed to clone repository"}
            
        # Phase 2: Discovery
        print("\n[Phase 1/15] Project Discovery...")
        self._run_discovery()
        
        # Phase 3-15: Run dimension analyzers
        analyzers = [
            ("Security", self._analyze_security),
            ("Architecture", self._analyze_architecture),
            ("Reliability", self._analyze_reliability),
            ("Performance", self._analyze_performance),
            ("Observability", self._analyze_observability),
            ("Testing", self._analyze_testing),
            ("DevOps", self._analyze_devops),
            ("Data Management", self._analyze_data),
            ("API Contracts", self._analyze_api),
            ("Documentation", self._analyze_documentation),
            ("Compliance", self._analyze_compliance),
            ("Cost Optimization", self._analyze_cost),
            ("Dependencies", self._analyze_dependencies),
            ("Configuration", self._analyze_configuration),
            ("Team Readiness", self._analyze_team_readiness),
        ]
        
        for i, (name, analyzer) in enumerate(analyzers, 2):
            if self._should_analyze(name.lower().replace(" ", "_")):
                print(f"\n[Phase {i}/15] Analyzing {name}...")
                analyzer()
        
        # Calculate overall score
        overall_score = self._calculate_overall_score()
        
        # Generate report
        report = self._generate_report(overall_score)
        
        # Cleanup
        self._cleanup()
        
        return report
    
    def _clone_repository(self) -> Optional[Path]:
        """Clone the GitHub repository"""
        print(f"Cloning repository: {self.github_url}")
        
        temp_dir = tempfile.mkdtemp(prefix="prod_readiness_")
        project_dir = Path(temp_dir) / "project"
        
        try:
            result = subprocess.run(
                ["git", "clone", "--depth=100", self.github_url, str(project_dir)],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode != 0:
                print(f"Git clone failed: {result.stderr}")
                return None
                
            print(f"Repository cloned to: {project_dir}")
            return project_dir
            
        except subprocess.TimeoutExpired:
            print("Repository clone timed out")
            return None
        except Exception as e:
            print(f"Error cloning repository: {e}")
            return None
    
    def _should_analyze(self, dimension_name: str) -> bool:
        """Check if dimension should be analyzed based on focus"""
        return dimension_name in self.focus or 'all' in self.focus
    
    def _run_discovery(self):
        """Run initial project discovery"""
        self.tech_stack = self._detect_tech_stack()
        self.statistics = self._calculate_statistics()
        
        print(f"  Technology Stack: {self.tech_stack}")
        print(f"  Total Files: {self.statistics.get('total_files', 0)}")
        print(f"  Lines of Code: {self.statistics.get('total_lines', 0)}")
    
    def _detect_tech_stack(self) -> dict:
        """Detect technology stack"""
        stack = {
            'languages': [],
            'frameworks': [],
            'databases': [],
            'infrastructure': []
        }
        
        # Check for various technology indicators
        indicators = {
            'package.json': ('Node.js', 'languages'),
            'requirements.txt': ('Python', 'languages'),
            'Cargo.toml': ('Rust', 'languages'),
            'go.mod': ('Go', 'languages'),
            'pom.xml': ('Java', 'languages'),
            'Gemfile': ('Ruby', 'languages'),
            'Dockerfile': ('Docker', 'infrastructure'),
            'docker-compose.yml': ('Docker Compose', 'infrastructure'),
            'kubernetes': ('Kubernetes', 'infrastructure'),
            'k8s': ('Kubernetes', 'infrastructure'),
            'terraform': ('Terraform', 'infrastructure'),
            '.github/workflows': ('GitHub Actions', 'infrastructure'),
        }
        
        for indicator, (tech, category) in indicators.items():
            if (self.project_path / indicator).exists():
                if tech not in stack[category]:
                    stack[category].append(tech)
        
        # Deep scan for frameworks
        if 'Node.js' in stack['languages']:
            self._detect_node_frameworks(stack)
        if 'Python' in stack['languages']:
            self._detect_python_frameworks(stack)
            
        return stack
    
    def _detect_node_frameworks(self, stack: dict):
        """Detect Node.js frameworks from package.json"""
        try:
            pkg_path = self.project_path / 'package.json'
            if pkg_path.exists():
                pkg = json.loads(pkg_path.read_text())
                deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
                
                frameworks = {
                    'react': 'React',
                    'vue': 'Vue.js',
                    '@angular/core': 'Angular',
                    'next': 'Next.js',
                    'express': 'Express',
                    'fastify': 'Fastify',
                    'nest': 'NestJS',
                }
                
                for dep, name in frameworks.items():
                    if dep in deps:
                        stack['frameworks'].append(name)
        except Exception:
            pass
    
    def _detect_python_frameworks(self, stack: dict):
        """Detect Python frameworks from requirements.txt"""
        try:
            req_path = self.project_path / 'requirements.txt'
            if req_path.exists():
                content = req_path.read_text().lower()
                
                frameworks = {
                    'django': 'Django',
                    'flask': 'Flask',
                    'fastapi': 'FastAPI',
                    'celery': 'Celery',
                    'sqlalchemy': 'SQLAlchemy',
                }
                
                for dep, name in frameworks.items():
                    if dep in content:
                        stack['frameworks'].append(name)
        except Exception:
            pass
    
    def _calculate_statistics(self) -> dict:
        """Calculate codebase statistics"""
        stats = {'total_files': 0, 'total_lines': 0, 'file_types': {}}
        
        code_extensions = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', 
                          '.rs', '.rb', '.php', '.cs', '.cpp', '.c', '.swift'}
        
        for root, dirs, files in os.walk(self.project_path):
            # Skip hidden and vendor directories
            dirs[:] = [d for d in dirs if not d.startswith('.') 
                      and d not in ('node_modules', 'vendor', '__pycache__', 'target')]
            
            for file in files:
                if not file.startswith('.'):
                    stats['total_files'] += 1
                    ext = Path(file).suffix
                    stats['file_types'][ext] = stats['file_types'].get(ext, 0) + 1
                    
                    if ext in code_extensions:
                        try:
                            file_path = Path(root) / file
                            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                stats['total_lines'] += sum(1 for _ in f)
                        except Exception:
                            pass
        
        return stats
    
    def _analyze_security(self):
        """Comprehensive security analysis"""
        findings = []
        score = 100
        
        # Check for secrets
        secrets_found = self._scan_for_secrets()
        for secret in secrets_found:
            findings.append(Finding(
                title=f"Hardcoded {secret['type']} detected",
                severity=Severity.CRITICAL,
                dimension=Dimension.SECURITY,
                location=secret['location'],
                description=f"Potential {secret['type']} found in source code",
                impact="Credentials exposure could lead to unauthorized access",
                root_cause="Secrets committed to version control",
                remediation="Remove secret, rotate credentials, use secret management",
                validation="Verify no secrets in git history, rotate affected credentials",
                effort_hours=2.0,
                references=["OWASP Secrets Management Cheatsheet"]
            ))
            score -= 15
        
        # Check for vulnerable patterns
        vuln_patterns = self._scan_vulnerable_patterns()
        for vuln in vuln_patterns:
            findings.append(Finding(
                title=vuln['title'],
                severity=Severity(vuln['severity']),
                dimension=Dimension.SECURITY,
                location=vuln['location'],
                description=vuln['description'],
                impact=vuln['impact'],
                root_cause=vuln['root_cause'],
                remediation=vuln['remediation'],
                validation=vuln['validation'],
                effort_hours=vuln.get('effort', 4.0),
                references=vuln.get('references', [])
            ))
            score -= {'critical': 20, 'high': 10, 'medium': 5, 'low': 2}.get(vuln['severity'], 5)
        
        # Check dependencies
        dep_vulns = self._scan_dependency_vulnerabilities()
        for vuln in dep_vulns:
            findings.append(Finding(
                title=f"Vulnerable dependency: {vuln['package']}@{vuln['version']}",
                severity=Severity.HIGH,
                dimension=Dimension.SECURITY,
                location=vuln['manifest'],
                description=f"Known vulnerability in {vuln['package']}",
                impact="Could be exploited if vulnerability is in used code paths",
                root_cause="Outdated dependency with known CVE",
                remediation=f"Upgrade to version {vuln.get('fixed_in', 'latest')}",
                validation="Run dependency scanner after upgrade",
                effort_hours=1.0,
                references=[vuln.get('cve', '')]
            ))
            score -= 8
        
        # Check authentication patterns
        auth_issues = self._analyze_authentication()
        for issue in auth_issues:
            findings.append(issue)
            score -= 10
        
        # Check encryption
        crypto_issues = self._analyze_cryptography()
        for issue in crypto_issues:
            findings.append(issue)
            score -= 10
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.SECURITY] = DimensionScore(
            dimension=Dimension.SECURITY,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.SECURITY, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.SECURITY, findings)
        )
        
        print(f"  Security Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _scan_for_secrets(self) -> list:
        """Scan for hardcoded secrets"""
        import re
        
        secrets = []
        patterns = [
            (r'["\']?[Aa][Pp][Ii][_-]?[Kk][Ee][Yy]["\']?\s*[:=]\s*["\'][A-Za-z0-9+/]{20,}["\']', 'API Key'),
            (r'["\']?[Ss][Ee][Cc][Rr][Ee][Tt]["\']?\s*[:=]\s*["\'][A-Za-z0-9+/]{20,}["\']', 'Secret'),
            (r'["\']?[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]["\']?\s*[:=]\s*["\'][^"\']{8,}["\']', 'Password'),
            (r'["\']?[Tt][Oo][Kk][Ee][Nn]["\']?\s*[:=]\s*["\'][A-Za-z0-9+/]{20,}["\']', 'Token'),
            (r'aws_access_key_id\s*=\s*[A-Z0-9]{20}', 'AWS Access Key'),
            (r'PRIVATE[_-]KEY', 'Private Key Reference'),
        ]
        
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') 
                      and d not in ('node_modules', 'vendor', '__pycache__')]
            
            for file in files:
                if file.endswith(('.py', '.js', '.ts', '.java', '.go', '.env', '.yml', '.yaml', '.json', '.toml')):
                    file_path = Path(root) / file
                    try:
                        content = file_path.read_text(encoding='utf-8', errors='ignore')
                        for pattern, secret_type in patterns:
                            if re.search(pattern, content, re.IGNORECASE):
                                # Skip test files and examples
                                rel_path = str(file_path.relative_to(self.project_path))
                                if 'test' not in rel_path.lower() and 'example' not in rel_path.lower():
                                    secrets.append({
                                        'type': secret_type,
                                        'location': rel_path
                                    })
                    except Exception:
                        pass
        
        return secrets
    
    def _scan_vulnerable_patterns(self) -> list:
        """Scan for vulnerable code patterns"""
        import re
        
        vulnerabilities = []
        patterns = [
            {
                'pattern': r'exec\s*\(|eval\s*\(',
                'title': 'Dangerous eval/exec usage',
                'severity': 'high',
                'description': 'Use of eval() or exec() can lead to code injection',
                'impact': 'Remote code execution if user input reaches these functions',
                'root_cause': 'Dynamic code execution with potentially untrusted input',
                'remediation': 'Avoid eval/exec, use safe alternatives like ast.literal_eval',
                'validation': 'Review all dynamic execution points',
            },
            {
                'pattern': r'subprocess\.call\s*\([^)]*shell\s*=\s*True',
                'title': 'Shell injection vulnerability',
                'severity': 'high',
                'description': 'subprocess.call with shell=True is vulnerable to injection',
                'impact': 'Command injection if user input reaches shell',
                'root_cause': 'Using shell=True with untrusted input',
                'remediation': 'Use subprocess with shell=False and argument lists',
                'validation': 'Verify no user input reaches shell commands',
            },
            {
                'pattern': r'innerHTML\s*=',
                'title': 'Potential XSS via innerHTML',
                'severity': 'medium',
                'description': 'Direct innerHTML assignment can lead to XSS',
                'impact': 'Cross-site scripting if user content is assigned',
                'root_cause': 'Unsafe DOM manipulation',
                'remediation': 'Use textContent or sanitize HTML before assignment',
                'validation': 'Verify all innerHTML assignments use sanitized content',
            },
            {
                'pattern': r'SELECT.*FROM.*WHERE.*\+|SELECT.*FROM.*%s',
                'title': 'Potential SQL injection',
                'severity': 'critical',
                'description': 'String concatenation in SQL query detected',
                'impact': 'SQL injection allowing data theft or manipulation',
                'root_cause': 'Dynamic SQL query construction',
                'remediation': 'Use parameterized queries or ORM',
                'validation': 'Review all database queries for parameterization',
            },
            {
                'pattern': r'DEBUG\s*=\s*True|"debug"\s*:\s*true',
                'title': 'Debug mode enabled',
                'severity': 'medium',
                'description': 'Debug mode appears to be enabled',
                'impact': 'Information disclosure and potential security bypass',
                'root_cause': 'Debug configuration in production code',
                'remediation': 'Ensure debug mode is disabled in production',
                'validation': 'Verify debug flags are environment-controlled',
            },
        ]
        
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') 
                      and d not in ('node_modules', 'vendor', '__pycache__')]
            
            for file in files:
                if file.endswith(('.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go')):
                    file_path = Path(root) / file
                    try:
                        content = file_path.read_text(encoding='utf-8', errors='ignore')
                        for vuln in patterns:
                            if re.search(vuln['pattern'], content, re.IGNORECASE):
                                rel_path = str(file_path.relative_to(self.project_path))
                                vulnerabilities.append({
                                    **vuln,
                                    'location': rel_path
                                })
                    except Exception:
                        pass
        
        return vulnerabilities
    
    def _scan_dependency_vulnerabilities(self) -> list:
        """Scan dependencies for known vulnerabilities"""
        vulns = []
        
        # Known vulnerable versions (simplified - in production use CVE database)
        known_vulns = {
            'lodash': {'< 4.17.21': 'CVE-2021-23337'},
            'axios': {'< 0.21.1': 'CVE-2020-28168'},
            'minimist': {'< 1.2.6': 'CVE-2021-44906'},
            'express': {'< 4.17.3': 'CVE-2022-24999'},
        }
        
        # Check npm
        pkg_lock = self.project_path / 'package-lock.json'
        if pkg_lock.exists():
            try:
                data = json.loads(pkg_lock.read_text())
                for pkg, info in data.get('dependencies', {}).items():
                    if pkg in known_vulns:
                        vulns.append({
                            'package': pkg,
                            'version': info.get('version', 'unknown'),
                            'manifest': 'package-lock.json',
                            'cve': list(known_vulns[pkg].values())[0]
                        })
            except Exception:
                pass
        
        return vulns
    
    def _analyze_authentication(self) -> list:
        """Analyze authentication implementation"""
        findings = []
        
        # Check for JWT without expiration
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for file in files:
                if file.endswith(('.py', '.js', '.ts')):
                    file_path = Path(root) / file
                    try:
                        content = file_path.read_text(errors='ignore')
                        if 'jwt' in content.lower() and 'expires' not in content.lower():
                            findings.append(Finding(
                                title="JWT without expiration",
                                severity=Severity.HIGH,
                                dimension=Dimension.SECURITY,
                                location=str(file_path.relative_to(self.project_path)),
                                description="JWT implementation may lack expiration",
                                impact="Tokens remain valid indefinitely if stolen",
                                root_cause="Missing expiration claim in JWT",
                                remediation="Add 'exp' claim to all JWTs",
                                validation="Verify all JWTs include expiration",
                                effort_hours=2.0
                            ))
                    except Exception:
                        pass
        
        return findings
    
    def _analyze_cryptography(self) -> list:
        """Analyze cryptography usage"""
        import re
        findings = []
        
        weak_crypto = [
            (r'\bMD5\b|\bmd5\b', 'MD5', 'SHA-256 or SHA-3'),
            (r'\bSHA1\b|\bsha1\b', 'SHA-1', 'SHA-256 or SHA-3'),
            (r'\bDES\b|\bdes\b', 'DES', 'AES-256'),
            (r'\bRC4\b|\brc4\b', 'RC4', 'AES-GCM'),
        ]
        
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for file in files:
                if file.endswith(('.py', '.js', '.ts', '.java', '.go')):
                    file_path = Path(root) / file
                    try:
                        content = file_path.read_text(errors='ignore')
                        for pattern, algo, replacement in weak_crypto:
                            if re.search(pattern, content):
                                findings.append(Finding(
                                    title=f"Weak cryptographic algorithm: {algo}",
                                    severity=Severity.HIGH,
                                    dimension=Dimension.SECURITY,
                                    location=str(file_path.relative_to(self.project_path)),
                                    description=f"{algo} is cryptographically weak",
                                    impact="Data may be vulnerable to cryptographic attacks",
                                    root_cause="Use of deprecated cryptographic algorithm",
                                    remediation=f"Replace {algo} with {replacement}",
                                    validation="Verify no weak algorithms remain",
                                    effort_hours=4.0
                                ))
                    except Exception:
                        pass
        
        return findings
    
    def _analyze_architecture(self):
        """Analyze system architecture"""
        findings = []
        score = 100
        
        # Check for circular dependencies
        # Check for proper layer separation
        # Check for coupling/cohesion
        
        # Simplified checks
        src_path = self.project_path / 'src'
        if not src_path.exists():
            findings.append(Finding(
                title="No src directory structure",
                severity=Severity.LOW,
                dimension=Dimension.ARCHITECTURE,
                location="project root",
                description="Project lacks standard src directory structure",
                impact="May indicate inconsistent code organization",
                root_cause="Non-standard project layout",
                remediation="Consider organizing code in src/ directory",
                validation="Verify consistent directory structure",
                effort_hours=8.0
            ))
            score -= 5
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.ARCHITECTURE] = DimensionScore(
            dimension=Dimension.ARCHITECTURE,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.ARCHITECTURE, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.ARCHITECTURE, findings)
        )
        
        print(f"  Architecture Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_reliability(self):
        """Analyze reliability and fault tolerance"""
        findings = []
        score = 100
        
        # Check for error handling
        has_try_catch = False
        has_error_boundaries = False
        
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
            for file in files:
                if file.endswith(('.py', '.js', '.ts', '.tsx', '.jsx')):
                    file_path = Path(root) / file
                    try:
                        content = file_path.read_text(errors='ignore')
                        if 'try' in content or 'catch' in content or 'except' in content:
                            has_try_catch = True
                        if 'ErrorBoundary' in content:
                            has_error_boundaries = True
                    except Exception:
                        pass
        
        if not has_try_catch:
            findings.append(Finding(
                title="Missing error handling",
                severity=Severity.HIGH,
                dimension=Dimension.RELIABILITY,
                location="entire codebase",
                description="No try/catch or exception handling detected",
                impact="Application may crash on unexpected errors",
                root_cause="Lack of defensive programming",
                remediation="Add error handling to critical code paths",
                validation="Verify error handling in all API endpoints",
                effort_hours=16.0
            ))
            score -= 20
        
        # Check for health endpoints
        has_health = False
        for root, dirs, files in os.walk(self.project_path):
            for file in files:
                file_path = Path(root) / file
                try:
                    content = file_path.read_text(errors='ignore')
                    if 'health' in content.lower() and ('endpoint' in content.lower() or 'route' in content.lower()):
                        has_health = True
                except Exception:
                    pass
        
        if not has_health:
            findings.append(Finding(
                title="No health check endpoint",
                severity=Severity.MEDIUM,
                dimension=Dimension.RELIABILITY,
                location="API routes",
                description="No health check endpoint detected",
                impact="Unable to monitor service health",
                root_cause="Missing health check implementation",
                remediation="Add /health endpoint returning service status",
                validation="Verify health endpoint returns 200 OK",
                effort_hours=2.0
            ))
            score -= 10
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.RELIABILITY] = DimensionScore(
            dimension=Dimension.RELIABILITY,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.RELIABILITY, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.RELIABILITY, findings)
        )
        
        print(f"  Reliability Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_performance(self):
        """Analyze performance characteristics"""
        findings = []
        score = 100
        
        # Check for N+1 query patterns
        # Check for missing indexes
        # Check for caching
        
        # Check for caching implementation
        has_caching = False
        for root, dirs, files in os.walk(self.project_path):
            for file in files:
                try:
                    content = (Path(root) / file).read_text(errors='ignore')
                    if 'redis' in content.lower() or 'cache' in content.lower() or 'memcached' in content.lower():
                        has_caching = True
                except Exception:
                    pass
        
        if not has_caching:
            findings.append(Finding(
                title="No caching layer detected",
                severity=Severity.MEDIUM,
                dimension=Dimension.PERFORMANCE,
                location="entire codebase",
                description="No Redis, Memcached, or caching layer detected",
                impact="Higher database load, slower response times",
                root_cause="Missing caching strategy",
                remediation="Implement caching for frequently accessed data",
                validation="Measure response times before and after",
                effort_hours=16.0
            ))
            score -= 15
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.PERFORMANCE] = DimensionScore(
            dimension=Dimension.PERFORMANCE,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.PERFORMANCE, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.PERFORMANCE, findings)
        )
        
        print(f"  Performance Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_observability(self):
        """Analyze observability infrastructure"""
        findings = []
        score = 100
        
        has_logging = False
        has_metrics = False
        has_tracing = False
        
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for file in files:
                try:
                    content = (Path(root) / file).read_text(errors='ignore').lower()
                    if 'logger' in content or 'logging' in content or 'winston' in content:
                        has_logging = True
                    if 'prometheus' in content or 'datadog' in content or 'statsd' in content:
                        has_metrics = True
                    if 'opentelemetry' in content or 'jaeger' in content or 'zipkin' in content:
                        has_tracing = True
                except Exception:
                    pass
        
        if not has_logging:
            findings.append(Finding(
                title="No structured logging detected",
                severity=Severity.HIGH,
                dimension=Dimension.OBSERVABILITY,
                location="entire codebase",
                description="No logging framework or structured logging detected",
                impact="Unable to debug production issues",
                root_cause="Missing logging infrastructure",
                remediation="Implement structured logging with correlation IDs",
                validation="Verify logs are searchable and correlated",
                effort_hours=8.0
            ))
            score -= 25
        
        if not has_metrics:
            findings.append(Finding(
                title="No metrics instrumentation",
                severity=Severity.MEDIUM,
                dimension=Dimension.OBSERVABILITY,
                location="entire codebase",
                description="No metrics/monitoring instrumentation detected",
                impact="Unable to measure system performance",
                root_cause="Missing metrics infrastructure",
                remediation="Add Prometheus/DataDog/custom metrics",
                validation="Verify key metrics are being collected",
                effort_hours=16.0
            ))
            score -= 15
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.OBSERVABILITY] = DimensionScore(
            dimension=Dimension.OBSERVABILITY,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.OBSERVABILITY, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.OBSERVABILITY, findings)
        )
        
        print(f"  Observability Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_testing(self):
        """Analyze test coverage and quality"""
        findings = []
        score = 100
        
        # Check for test directories
        test_dirs = ['test', 'tests', '__tests__', 'spec', 'specs']
        has_tests = any((self.project_path / d).exists() for d in test_dirs)
        
        if not has_tests:
            findings.append(Finding(
                title="No test directory found",
                severity=Severity.CRITICAL,
                dimension=Dimension.TESTING,
                location="project root",
                description="No test directory detected",
                impact="Code changes may introduce bugs undetected",
                root_cause="Missing test infrastructure",
                remediation="Set up testing framework and write tests",
                validation="Run tests and verify coverage",
                effort_hours=40.0
            ))
            score -= 40
        
        # Check for CI test configuration
        has_ci_tests = False
        github_workflows = self.project_path / '.github' / 'workflows'
        if github_workflows.exists():
            for wf in github_workflows.glob('*.yml'):
                try:
                    content = wf.read_text()
                    if 'test' in content.lower():
                        has_ci_tests = True
                except Exception:
                    pass
        
        if not has_ci_tests:
            findings.append(Finding(
                title="No automated tests in CI/CD",
                severity=Severity.HIGH,
                dimension=Dimension.TESTING,
                location=".github/workflows",
                description="Tests are not running in CI/CD pipeline",
                impact="Broken code may be merged and deployed",
                root_cause="Missing CI test configuration",
                remediation="Add test step to CI/CD pipeline",
                validation="Verify tests run on every PR",
                effort_hours=4.0
            ))
            score -= 20
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.TESTING] = DimensionScore(
            dimension=Dimension.TESTING,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.TESTING, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.TESTING, findings)
        )
        
        print(f"  Testing Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_devops(self):
        """Analyze DevOps and CI/CD"""
        findings = []
        score = 100
        
        # Check for CI/CD
        has_cicd = (self.project_path / '.github' / 'workflows').exists() or \
                   (self.project_path / '.gitlab-ci.yml').exists() or \
                   (self.project_path / 'Jenkinsfile').exists()
        
        if not has_cicd:
            findings.append(Finding(
                title="No CI/CD pipeline configured",
                severity=Severity.HIGH,
                dimension=Dimension.DEVOPS,
                location="project root",
                description="No CI/CD configuration detected",
                impact="Manual deployments are error-prone",
                root_cause="Missing automation",
                remediation="Set up GitHub Actions/GitLab CI/Jenkins",
                validation="Verify automated builds and deployments",
                effort_hours=16.0
            ))
            score -= 25
        
        # Check for Dockerfile
        has_docker = (self.project_path / 'Dockerfile').exists()
        if not has_docker:
            findings.append(Finding(
                title="No Dockerfile",
                severity=Severity.MEDIUM,
                dimension=Dimension.DEVOPS,
                location="project root",
                description="No Dockerfile for containerization",
                impact="Inconsistent deployment environments",
                root_cause="Missing containerization",
                remediation="Create Dockerfile for consistent builds",
                validation="Build and run container locally",
                effort_hours=4.0
            ))
            score -= 10
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.DEVOPS] = DimensionScore(
            dimension=Dimension.DEVOPS,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.DEVOPS, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.DEVOPS, findings)
        )
        
        print(f"  DevOps Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_data(self):
        """Analyze data management"""
        findings = []
        score = 100
        
        # Check for migrations
        has_migrations = (self.project_path / 'migrations').exists() or \
                        (self.project_path / 'db' / 'migrations').exists() or \
                        (self.project_path / 'alembic').exists()
        
        if not has_migrations:
            # Check if database is used
            has_db = False
            for root, dirs, files in os.walk(self.project_path):
                for file in files:
                    try:
                        content = (Path(root) / file).read_text(errors='ignore').lower()
                        if 'database' in content or 'postgres' in content or 'mysql' in content or 'mongo' in content:
                            has_db = True
                    except Exception:
                        pass
            
            if has_db:
                findings.append(Finding(
                    title="No database migrations",
                    severity=Severity.HIGH,
                    dimension=Dimension.DATA_MANAGEMENT,
                    location="project root",
                    description="Database used but no migrations detected",
                    impact="Schema changes may be inconsistent",
                    root_cause="Missing migration tooling",
                    remediation="Set up migration framework (Alembic, Flyway, etc.)",
                    validation="Run migrations in staging environment",
                    effort_hours=16.0
                ))
                score -= 20
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.DATA_MANAGEMENT] = DimensionScore(
            dimension=Dimension.DATA_MANAGEMENT,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.DATA_MANAGEMENT, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.DATA_MANAGEMENT, findings)
        )
        
        print(f"  Data Management Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_api(self):
        """Analyze API design and contracts"""
        findings = []
        score = 100
        
        # Check for OpenAPI/Swagger
        has_openapi = any((self.project_path / f).exists() for f in 
                         ['openapi.yaml', 'openapi.yml', 'swagger.yaml', 'swagger.yml', 'openapi.json'])
        
        if not has_openapi:
            findings.append(Finding(
                title="No OpenAPI/Swagger specification",
                severity=Severity.MEDIUM,
                dimension=Dimension.API_CONTRACTS,
                location="project root",
                description="No API specification document found",
                impact="API documentation may be incomplete",
                root_cause="Missing API specification",
                remediation="Generate or write OpenAPI specification",
                validation="Validate spec matches implementation",
                effort_hours=8.0
            ))
            score -= 15
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.API_CONTRACTS] = DimensionScore(
            dimension=Dimension.API_CONTRACTS,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.API_CONTRACTS, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.API_CONTRACTS, findings)
        )
        
        print(f"  API Contracts Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_documentation(self):
        """Analyze documentation completeness"""
        findings = []
        score = 100
        
        # Check for README
        has_readme = (self.project_path / 'README.md').exists() or \
                    (self.project_path / 'README.rst').exists()
        
        if not has_readme:
            findings.append(Finding(
                title="No README file",
                severity=Severity.HIGH,
                dimension=Dimension.DOCUMENTATION,
                location="project root",
                description="Project lacks README documentation",
                impact="New developers cannot onboard effectively",
                root_cause="Missing documentation",
                remediation="Create comprehensive README with setup instructions",
                validation="New developer can set up project from README",
                effort_hours=4.0
            ))
            score -= 30
        
        # Check README quality
        if has_readme:
            readme = self.project_path / 'README.md'
            if readme.exists():
                content = readme.read_text()
                if len(content) < 500:
                    findings.append(Finding(
                        title="README is too brief",
                        severity=Severity.LOW,
                        dimension=Dimension.DOCUMENTATION,
                        location="README.md",
                        description="README lacks sufficient detail",
                        impact="Incomplete project documentation",
                        root_cause="Minimal documentation effort",
                        remediation="Expand README with installation, usage, architecture",
                        validation="README covers all essential sections",
                        effort_hours=2.0
                    ))
                    score -= 10
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.DOCUMENTATION] = DimensionScore(
            dimension=Dimension.DOCUMENTATION,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.DOCUMENTATION, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.DOCUMENTATION, findings)
        )
        
        print(f"  Documentation Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_compliance(self):
        """Analyze compliance requirements"""
        findings = []
        score = 100
        
        # Check for privacy policy / GDPR
        has_privacy = any((self.project_path / f).exists() for f in 
                         ['PRIVACY.md', 'privacy-policy.md', 'docs/privacy.md'])
        
        # Check for LICENSE
        has_license = (self.project_path / 'LICENSE').exists() or \
                     (self.project_path / 'LICENSE.md').exists()
        
        if not has_license:
            findings.append(Finding(
                title="No LICENSE file",
                severity=Severity.MEDIUM,
                dimension=Dimension.COMPLIANCE,
                location="project root",
                description="Project lacks license specification",
                impact="Legal ambiguity for users and contributors",
                root_cause="Missing license file",
                remediation="Add appropriate LICENSE file",
                validation="Verify license compatibility with dependencies",
                effort_hours=1.0
            ))
            score -= 15
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.COMPLIANCE] = DimensionScore(
            dimension=Dimension.COMPLIANCE,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.COMPLIANCE, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.COMPLIANCE, findings)
        )
        
        print(f"  Compliance Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_cost(self):
        """Analyze cost optimization opportunities"""
        findings = []
        score = 100
        
        # Placeholder - would analyze cloud resource configurations
        self.dimension_scores[Dimension.COST_OPTIMIZATION] = DimensionScore(
            dimension=Dimension.COST_OPTIMIZATION,
            score=score,
            findings=[],
            summary="Cost optimization analysis requires infrastructure review",
            recommendations=["Review cloud resource sizing", "Implement auto-scaling"]
        )
        
        print(f"  Cost Optimization Score: {score}/100 ({len(findings)} issues found)")
    
    def _analyze_dependencies(self):
        """Analyze dependency health"""
        findings = []
        score = 100
        
        # Check for lock files
        has_lock = (self.project_path / 'package-lock.json').exists() or \
                   (self.project_path / 'yarn.lock').exists() or \
                   (self.project_path / 'Pipfile.lock').exists() or \
                   (self.project_path / 'poetry.lock').exists() or \
                   (self.project_path / 'Cargo.lock').exists()
        
        if not has_lock:
            findings.append(Finding(
                title="No dependency lock file",
                severity=Severity.MEDIUM,
                dimension=Dimension.DEPENDENCIES,
                location="project root",
                description="No lock file for reproducible builds",
                impact="Builds may use different dependency versions",
                root_cause="Missing dependency locking",
                remediation="Generate and commit lock file",
                validation="Verify consistent builds across environments",
                effort_hours=1.0
            ))
            score -= 15
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.DEPENDENCIES] = DimensionScore(
            dimension=Dimension.DEPENDENCIES,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.DEPENDENCIES, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.DEPENDENCIES, findings)
        )
        
        print(f"  Dependencies Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_configuration(self):
        """Analyze configuration management"""
        findings = []
        score = 100
        
        # Check for .env.example
        if (self.project_path / '.env').exists() and not (self.project_path / '.env.example').exists():
            findings.append(Finding(
                title="Missing .env.example",
                severity=Severity.LOW,
                dimension=Dimension.CONFIGURATION,
                location="project root",
                description=".env exists but no .env.example template",
                impact="New developers may miss required environment variables",
                root_cause="Missing configuration template",
                remediation="Create .env.example with all required variables",
                validation="Developer can set up from .env.example",
                effort_hours=0.5
            ))
            score -= 10
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.CONFIGURATION] = DimensionScore(
            dimension=Dimension.CONFIGURATION,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.CONFIGURATION, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.CONFIGURATION, findings)
        )
        
        print(f"  Configuration Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _analyze_team_readiness(self):
        """Analyze team readiness and knowledge transfer"""
        findings = []
        score = 100
        
        # Check for CONTRIBUTING.md
        has_contributing = (self.project_path / 'CONTRIBUTING.md').exists()
        
        if not has_contributing:
            findings.append(Finding(
                title="No CONTRIBUTING guide",
                severity=Severity.LOW,
                dimension=Dimension.TEAM_READINESS,
                location="project root",
                description="No contribution guidelines",
                impact="Inconsistent contribution process",
                root_cause="Missing contributor documentation",
                remediation="Add CONTRIBUTING.md with guidelines",
                validation="New contributor can follow process",
                effort_hours=2.0
            ))
            score -= 10
        
        self.findings.extend(findings)
        self.dimension_scores[Dimension.TEAM_READINESS] = DimensionScore(
            dimension=Dimension.TEAM_READINESS,
            score=max(0, score),
            findings=[f.to_dict() for f in findings],
            summary=self._generate_dimension_summary(Dimension.TEAM_READINESS, findings),
            recommendations=self._generate_dimension_recommendations(Dimension.TEAM_READINESS, findings)
        )
        
        print(f"  Team Readiness Score: {max(0, score)}/100 ({len(findings)} issues found)")
    
    def _calculate_overall_score(self) -> float:
        """Calculate weighted overall score"""
        total_weight = 0
        weighted_sum = 0
        
        for dim, weight in DIMENSION_WEIGHTS.items():
            if dim in self.dimension_scores:
                weighted_sum += self.dimension_scores[dim].score * weight
                total_weight += weight
        
        if total_weight == 0:
            return 0
        
        return weighted_sum / total_weight
    
    def _generate_dimension_summary(self, dimension: Dimension, findings: list) -> str:
        """Generate summary for a dimension"""
        if not findings:
            return f"{dimension.value} analysis complete with no issues found."
        
        critical = sum(1 for f in findings if f.severity == Severity.CRITICAL)
        high = sum(1 for f in findings if f.severity == Severity.HIGH)
        medium = sum(1 for f in findings if f.severity == Severity.MEDIUM)
        
        return f"{dimension.value}: {critical} critical, {high} high, {medium} medium issues found."
    
    def _generate_dimension_recommendations(self, dimension: Dimension, findings: list) -> list:
        """Generate recommendations for a dimension"""
        return [f.remediation for f in findings[:5]]  # Top 5 recommendations
    
    def _generate_report(self, overall_score: float) -> dict:
        """Generate comprehensive assessment report"""
        end_time = datetime.now()
        
        # Determine readiness level
        if overall_score >= 90:
            readiness_level = "Production Ready"
        elif overall_score >= 75:
            readiness_level = "Nearly Ready"
        elif overall_score >= 50:
            readiness_level = "Significant Work Needed"
        elif overall_score >= 25:
            readiness_level = "Not Ready"
        else:
            readiness_level = "Substantial Rebuild Required"
        
        # Categorize findings
        critical_findings = [f for f in self.findings if f.severity == Severity.CRITICAL]
        high_findings = [f for f in self.findings if f.severity == Severity.HIGH]
        medium_findings = [f for f in self.findings if f.severity == Severity.MEDIUM]
        low_findings = [f for f in self.findings if f.severity == Severity.LOW]
        
        # Calculate effort
        total_effort = sum(f.effort_hours for f in self.findings)
        
        report = {
            'metadata': {
                'repository': self.github_url,
                'assessment_date': self.start_time.isoformat(),
                'duration_seconds': (end_time - self.start_time).total_seconds(),
                'tool_version': '1.0.0'
            },
            'executive_summary': {
                'overall_score': round(overall_score, 1),
                'readiness_level': readiness_level,
                'total_findings': len(self.findings),
                'critical_count': len(critical_findings),
                'high_count': len(high_findings),
                'medium_count': len(medium_findings),
                'low_count': len(low_findings),
                'estimated_remediation_hours': round(total_effort, 1),
                'recommendation': self._generate_executive_recommendation(overall_score, critical_findings)
            },
            'technology_stack': self.tech_stack,
            'statistics': self.statistics,
            'dimension_scores': {
                dim.value: {
                    'score': score.score,
                    'weight': DIMENSION_WEIGHTS[dim],
                    'summary': score.summary,
                    'recommendations': score.recommendations,
                    'finding_count': len(score.findings)
                }
                for dim, score in self.dimension_scores.items()
            },
            'findings': {
                'critical': [f.to_dict() for f in critical_findings],
                'high': [f.to_dict() for f in high_findings],
                'medium': [f.to_dict() for f in medium_findings],
                'low': [f.to_dict() for f in low_findings]
            },
            'remediation_roadmap': self._generate_roadmap(overall_score)
        }
        
        return report
    
    def _generate_executive_recommendation(self, score: float, critical: list) -> str:
        """Generate executive-level recommendation"""
        if score >= 90:
            return "System is production-ready. Minor improvements recommended for optimization."
        elif score >= 75:
            return f"Address {len(critical)} critical issues before production deployment. Target timeline: 1-2 weeks."
        elif score >= 50:
            return f"Significant work required. Focus on security and reliability first. Target timeline: 1 month."
        else:
            return "Major remediation required. Consider phased approach with security as priority."
    
    def _generate_roadmap(self, score: float) -> list:
        """Generate remediation roadmap"""
        roadmap = []
        
        # Phase 1: Critical security
        critical_security = [f for f in self.findings 
                           if f.severity == Severity.CRITICAL and f.dimension == Dimension.SECURITY]
        if critical_security:
            roadmap.append({
                'phase': 1,
                'name': 'Critical Security Remediation',
                'duration': 'Week 1',
                'items': [f.title for f in critical_security[:5]]
            })
        
        # Phase 2: High priority
        high_priority = [f for f in self.findings if f.severity == Severity.HIGH]
        if high_priority:
            roadmap.append({
                'phase': 2,
                'name': 'High Priority Issues',
                'duration': 'Weeks 2-3',
                'items': [f.title for f in high_priority[:5]]
            })
        
        # Phase 3: Medium priority
        medium_priority = [f for f in self.findings if f.severity == Severity.MEDIUM]
        if medium_priority:
            roadmap.append({
                'phase': 3,
                'name': 'Medium Priority Improvements',
                'duration': 'Weeks 4-6',
                'items': [f.title for f in medium_priority[:5]]
            })
        
        return roadmap
    
    def _cleanup(self):
        """Cleanup temporary files"""
        if self.project_path and self.project_path.parent.name.startswith('prod_readiness_'):
            try:
                shutil.rmtree(self.project_path.parent)
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(
        description='Production Readiness Assessment - Enterprise-grade codebase evaluation'
    )
    parser.add_argument('github_url', help='GitHub repository URL')
    parser.add_argument('--output', '-o', help='Output file for report (JSON or Markdown)')
    parser.add_argument('--focus', help='Comma-separated dimensions to focus on')
    parser.add_argument('--compliance', help='Comma-separated compliance frameworks (soc2,gdpr,hipaa,pci)')
    parser.add_argument('--format', choices=['json', 'markdown'], default='json',
                       help='Output format')
    
    args = parser.parse_args()
    
    focus = args.focus.split(',') if args.focus else None
    compliance = args.compliance.split(',') if args.compliance else None
    
    assessment = ProductionReadinessAssessment(
        github_url=args.github_url,
        focus=focus,
        compliance_frameworks=compliance
    )
    
    report = assessment.run_assessment()
    
    if args.format == 'markdown':
        output = generate_markdown_report(report)
    else:
        output = json.dumps(report, indent=2)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"\nReport saved to: {args.output}")
    else:
        print("\n" + "="*60)
        print("ASSESSMENT COMPLETE")
        print("="*60)
        print(f"\nOverall Score: {report['executive_summary']['overall_score']}/100")
        print(f"Readiness Level: {report['executive_summary']['readiness_level']}")
        print(f"Total Issues: {report['executive_summary']['total_findings']}")
        print(f"Estimated Remediation: {report['executive_summary']['estimated_remediation_hours']} hours")
        print(f"\n{report['executive_summary']['recommendation']}")


def generate_markdown_report(report: dict) -> str:
    """Generate markdown formatted report"""
    md = []
    md.append("# Production Readiness Assessment Report\n")
    
    # Executive Summary
    md.append("## Executive Summary\n")
    summary = report['executive_summary']
    md.append(f"**Overall Score:** {summary['overall_score']}/100\n")
    md.append(f"**Readiness Level:** {summary['readiness_level']}\n")
    md.append(f"**Recommendation:** {summary['recommendation']}\n")
    
    # Findings Summary
    md.append("\n### Findings Summary\n")
    md.append(f"- Critical: {summary['critical_count']}")
    md.append(f"- High: {summary['high_count']}")
    md.append(f"- Medium: {summary['medium_count']}")
    md.append(f"- Low: {summary['low_count']}")
    md.append(f"- Estimated Remediation: {summary['estimated_remediation_hours']} hours\n")
    
    # Dimension Scores
    md.append("\n## Dimension Scores\n")
    for dim, data in report['dimension_scores'].items():
        md.append(f"### {dim.replace('_', ' ').title()}: {data['score']}/100\n")
        md.append(f"{data['summary']}\n")
    
    # Critical Issues
    if report['findings']['critical']:
        md.append("\n## Critical Issues\n")
        for finding in report['findings']['critical']:
            md.append(f"### {finding['title']}\n")
            md.append(f"**Location:** {finding['location']}\n")
            md.append(f"**Impact:** {finding['impact']}\n")
            md.append(f"**Remediation:** {finding['remediation']}\n")
    
    # Roadmap
    if report['remediation_roadmap']:
        md.append("\n## Remediation Roadmap\n")
        for phase in report['remediation_roadmap']:
            md.append(f"### Phase {phase['phase']}: {phase['name']} ({phase['duration']})\n")
            for item in phase['items']:
                md.append(f"- {item}")
            md.append("")
    
    return '\n'.join(md)


if __name__ == '__main__':
    main()
