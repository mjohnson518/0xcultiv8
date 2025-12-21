# Compliance Frameworks Reference

Comprehensive compliance verification checklists for SOC 2, GDPR, HIPAA, and PCI-DSS.

## SOC 2 Type II

### Trust Service Criteria

#### Security (Common Criteria)

**CC1: Control Environment**
- [ ] Security policies documented and communicated
- [ ] Organizational structure defines security responsibilities
- [ ] Management commitment to security demonstrated
- [ ] HR policies include security requirements

**CC2: Communication and Information**
- [ ] Security policies accessible to all personnel
- [ ] Security awareness training conducted
- [ ] External party communication procedures defined
- [ ] Security incidents communicated appropriately

**CC3: Risk Assessment**
- [ ] Risk assessment performed annually
- [ ] Risks identified and documented
- [ ] Risk mitigation strategies implemented
- [ ] Third-party risks assessed

**CC4: Monitoring Activities**
- [ ] Security monitoring implemented
- [ ] Deviations detected and addressed
- [ ] Control effectiveness evaluated
- [ ] Remediation tracked to completion

**CC5: Control Activities**
- [ ] Policies map to controls
- [ ] Technology controls documented
- [ ] Segregation of duties implemented
- [ ] Change management process followed

**CC6: Logical and Physical Access**
- [ ] User access provisioning process
- [ ] Access reviews performed quarterly
- [ ] Privileged access restricted
- [ ] Access revocation procedures
- [ ] Physical access controls

**CC7: System Operations**
- [ ] Vulnerability management program
- [ ] Incident response procedures
- [ ] Change management process
- [ ] System monitoring implemented

**CC8: Change Management**
- [ ] Change management policy
- [ ] Testing requirements defined
- [ ] Approval workflow documented
- [ ] Emergency change procedures

**CC9: Risk Mitigation**
- [ ] Business continuity plan
- [ ] Disaster recovery plan
- [ ] Vendor management program
- [ ] Insurance coverage reviewed

### Availability Criteria

- [ ] Capacity planning performed
- [ ] SLA definitions documented
- [ ] Redundancy implemented
- [ ] Failover procedures tested
- [ ] Backup procedures documented
- [ ] Recovery testing performed

### Confidentiality Criteria

- [ ] Data classification policy
- [ ] Encryption requirements defined
- [ ] Data handling procedures
- [ ] Confidential data inventory
- [ ] Data disposal procedures

### Processing Integrity Criteria

- [ ] Data validation controls
- [ ] Processing accuracy verification
- [ ] Error handling procedures
- [ ] Completeness controls

### Privacy Criteria

- [ ] Privacy policy published
- [ ] Consent management
- [ ] Data subject rights procedures
- [ ] Data retention policy
- [ ] Third-party data sharing documented

## GDPR Compliance

### Data Processing Requirements

**Article 5: Principles**
- [ ] Lawfulness, fairness, transparency
- [ ] Purpose limitation documented
- [ ] Data minimization practiced
- [ ] Accuracy maintained
- [ ] Storage limitation enforced
- [ ] Integrity and confidentiality ensured
- [ ] Accountability demonstrated

**Article 6: Lawful Basis**
- [ ] Legal basis documented per processing activity
- [ ] Consent mechanism implemented (if applicable)
- [ ] Legitimate interest assessment (if applicable)
- [ ] Contract necessity documented (if applicable)

### Data Subject Rights

**Article 15: Right of Access**
- [ ] Data access request process
- [ ] Response within 30 days
- [ ] Data export functionality
- [ ] Identity verification process

**Article 16: Right to Rectification**
- [ ] Data correction capability
- [ ] Propagation to third parties

**Article 17: Right to Erasure**
- [ ] Data deletion capability
- [ ] Backup purging process
- [ ] Third-party notification
- [ ] Exceptions documented

**Article 18: Right to Restriction**
- [ ] Processing restriction capability
- [ ] Marking mechanism for restricted data

**Article 20: Right to Portability**
- [ ] Machine-readable export (JSON/CSV)
- [ ] Direct transfer capability

### Technical Measures

**Article 25: Data Protection by Design**
- [ ] Privacy impact assessments
- [ ] Pseudonymization implemented
- [ ] Data minimization in design
- [ ] Security by default

**Article 32: Security of Processing**
- [ ] Encryption at rest and in transit
- [ ] Access control systems
- [ ] Regular security testing
- [ ] Incident response capability
- [ ] Backup and recovery

**Article 33: Breach Notification**
- [ ] 72-hour notification capability
- [ ] Breach detection mechanisms
- [ ] Notification templates prepared
- [ ] Supervisory authority contacts

**Article 35: DPIA Requirements**
- [ ] High-risk processing identified
- [ ] DPIAs conducted and documented
- [ ] Mitigation measures implemented

### Records and Documentation

**Article 30: Records of Processing**
- [ ] Processing activities inventory
- [ ] Data categories documented
- [ ] Recipients documented
- [ ] Retention periods defined
- [ ] Security measures described

## HIPAA Compliance

### Administrative Safeguards (§164.308)

**Risk Analysis and Management**
- [ ] Risk analysis conducted
- [ ] Risks documented and prioritized
- [ ] Risk management plan
- [ ] Annual reassessment

**Workforce Security**
- [ ] Authorization and supervision
- [ ] Workforce clearance procedures
- [ ] Termination procedures
- [ ] Access authorization

**Information Access Management**
- [ ] Access authorization policy
- [ ] Access establishment and modification
- [ ] Minimum necessary standard

**Security Awareness Training**
- [ ] Security reminders
- [ ] Protection from malicious software
- [ ] Log-in monitoring
- [ ] Password management

**Security Incident Procedures**
- [ ] Incident response plan
- [ ] Incident documentation
- [ ] Mitigation procedures

**Contingency Plan**
- [ ] Data backup plan
- [ ] Disaster recovery plan
- [ ] Emergency mode operation
- [ ] Testing and revision
- [ ] Applications and data criticality analysis

**Evaluation**
- [ ] Periodic evaluation performed
- [ ] Technical and non-technical evaluation

**Business Associate Contracts**
- [ ] BAA requirements met
- [ ] Subcontractor flow-down

### Physical Safeguards (§164.310)

- [ ] Facility access controls
- [ ] Workstation use policy
- [ ] Workstation security
- [ ] Device and media controls

### Technical Safeguards (§164.312)

**Access Control**
- [ ] Unique user identification
- [ ] Emergency access procedure
- [ ] Automatic logoff
- [ ] Encryption and decryption

**Audit Controls**
- [ ] Audit log mechanisms
- [ ] Log review procedures
- [ ] Log retention

**Integrity Controls**
- [ ] Data integrity mechanisms
- [ ] Electronic signature (if used)

**Transmission Security**
- [ ] Integrity controls
- [ ] Encryption in transit

### Breach Notification (§164.400)

- [ ] Individual notification capability
- [ ] HHS notification procedures
- [ ] Media notification (>500 individuals)
- [ ] Breach documentation

## PCI-DSS v4.0 Compliance

### Requirement 1: Network Security Controls

- [ ] Network security controls installed
- [ ] Inbound/outbound traffic restricted
- [ ] Network segmentation implemented
- [ ] NSC configuration standards

### Requirement 2: Secure Configurations

- [ ] Vendor defaults changed
- [ ] System hardening standards
- [ ] Primary functions separated
- [ ] Unnecessary services disabled

### Requirement 3: Protect Stored Account Data

- [ ] Data retention policy
- [ ] SAD not stored after authorization
- [ ] PAN rendered unreadable (encryption/hashing)
- [ ] Key management procedures

### Requirement 4: Protect Data in Transit

- [ ] Strong cryptography for transmission
- [ ] Certificate management
- [ ] Only trusted keys/certificates

### Requirement 5: Malware Protection

- [ ] Anti-malware deployed
- [ ] Periodic scans performed
- [ ] Audit logs maintained
- [ ] Mechanisms cannot be disabled

### Requirement 6: Secure Development

- [ ] Secure development lifecycle
- [ ] Security in change control
- [ ] Vulnerability identification
- [ ] Public-facing application protection (WAF)
- [ ] Code review for custom applications

### Requirement 7: Access Restriction

- [ ] Access limited to need-to-know
- [ ] Access control system defined
- [ ] Default deny-all policy

### Requirement 8: User Identification

- [ ] Unique IDs assigned
- [ ] Strong authentication
- [ ] MFA for CDE access
- [ ] Password requirements met

### Requirement 9: Physical Access Restriction

- [ ] Facility entry controls
- [ ] Visitor management
- [ ] Media handling procedures
- [ ] POI device protection

### Requirement 10: Logging and Monitoring

- [ ] Audit logs enabled
- [ ] Log content requirements met
- [ ] Time synchronization
- [ ] Log protection
- [ ] Log review performed

### Requirement 11: Regular Testing

- [ ] Wireless AP detection
- [ ] Internal vulnerability scans (quarterly)
- [ ] External vulnerability scans (quarterly, ASV)
- [ ] Penetration testing (annual)
- [ ] Change detection mechanisms

### Requirement 12: Information Security Policy

- [ ] Security policy established
- [ ] Acceptable use policies
- [ ] Risk assessment (annual)
- [ ] Security awareness program
- [ ] Incident response plan
- [ ] Service provider management

## Compliance Verification Checklist

### Documentation Requirements

| Framework | Required Documentation |
|-----------|----------------------|
| SOC 2 | Policies, procedures, risk assessments, control descriptions |
| GDPR | Processing records, DPIAs, privacy notices, consent records |
| HIPAA | Risk analysis, policies, BAAs, training records |
| PCI-DSS | Network diagrams, data flow diagrams, policies, scan reports |

### Technical Evidence

| Framework | Technical Evidence |
|-----------|-------------------|
| SOC 2 | System descriptions, control screenshots, audit logs |
| GDPR | Encryption configs, access logs, deletion capabilities |
| HIPAA | Encryption evidence, audit trails, backup tests |
| PCI-DSS | Vulnerability scans, penetration test reports, NSC configs |

### Audit Frequency

| Framework | Audit Frequency | Scope |
|-----------|----------------|-------|
| SOC 2 Type II | Annual | 12-month period |
| GDPR | Ongoing + supervisory | All processing activities |
| HIPAA | Annual + ongoing | All ePHI handling |
| PCI-DSS | Annual + quarterly scans | Cardholder data environment |
