const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, 'components/dashboard/DashboardClient.tsx');
const adminPath = path.join(__dirname, 'components/admin/AdminDashboardClient.tsx');

let dashContent = fs.readFileSync(dashPath, 'utf8');
let adminContent = fs.readFileSync(adminPath, 'utf8');

// Extract the exact block of Agent1Visuals from DashboardClient.tsx
const startMarker = 'function Agent1Visuals({ issue, isRunning }: { issue: Issue, isRunning: boolean }) {';
const endMarker = 'function Agent3Visuals({ isRunning, issue }: { isRunning: boolean, issue: any }) {';

const startIndex = dashContent.indexOf(startMarker);
const endIndex = dashContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found in DashboardClient.tsx");
  process.exit(1);
}

const copiedBlock = dashContent.substring(startIndex, endIndex);

// Now find the markers in AdminDashboardClient.tsx
const adminStartMarker = 'function Agent1Visuals({ issue, isRunning }: { issue: Issue, isRunning: boolean }) {';
const adminEndMarker = 'function Agent3Visuals({ isRunning, issue }: { isRunning: boolean, issue: any }) {';

const adminStartIndex = adminContent.indexOf(adminStartMarker);
const adminEndIndex = adminContent.indexOf(adminEndMarker);

if (adminStartIndex === -1 || adminEndIndex === -1) {
  console.error("Markers not found in AdminDashboardClient.tsx");
  process.exit(1);
}

// Replace the block in AdminDashboardClient.tsx
let newAdminContent = adminContent.substring(0, adminStartIndex) + copiedBlock + adminContent.substring(adminEndIndex);

fs.writeFileSync(adminPath, newAdminContent);
console.log("AdminDashboardClient.tsx patched with Agent1Visuals successfully.");
