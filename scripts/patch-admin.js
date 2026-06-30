const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, 'components/dashboard/DashboardClient.tsx');
const adminPath = path.join(__dirname, 'components/admin/AdminDashboardClient.tsx');

let dashContent = fs.readFileSync(dashPath, 'utf8');
let adminContent = fs.readFileSync(adminPath, 'utf8');

// Extract the exact block from DashboardClient.tsx
// From `<DialogContent className="` to `{/* Footer Buttons */}`
const startMarker = '<DialogContent className="bg-background';
const endMarker = '{/* Footer Buttons */}';

const startIndex = dashContent.indexOf(startMarker);
const endIndex = dashContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found in DashboardClient.tsx");
  process.exit(1);
}

const copiedBlock = dashContent.substring(startIndex, endIndex);

// Now find the markers in AdminDashboardClient.tsx
const adminStartMarker = '<DialogContent className="bg-background';
const adminEndMarker = '{/* Divider between AI trace and Admin Actions */}';

const adminStartIndex = adminContent.indexOf(adminStartMarker);
const adminEndIndex = adminContent.indexOf(adminEndMarker);

if (adminStartIndex === -1 || adminEndIndex === -1) {
  console.error("Markers not found in AdminDashboardClient.tsx");
  process.exit(1);
}

// Replace the block in AdminDashboardClient.tsx
let newAdminContent = adminContent.substring(0, adminStartIndex) + copiedBlock + adminContent.substring(adminEndIndex);

// Upgrade the Admin Controls styling
newAdminContent = newAdminContent.replace(
  '<div className="bg-card/50 border border-border rounded-xl p-5 space-y-4 mb-6">',
  '<div className="bg-black/40 border border-[#0969da]/30 rounded-xl p-6 sm:p-8 space-y-6 mb-6 shadow-inner relative overflow-hidden">\n                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0969da]/50" />'
);

newAdminContent = newAdminContent.replace(
  '<h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 leading-none">',
  '<h4 className="text-[13px] font-bold text-foreground tracking-wider uppercase flex items-center gap-2 leading-none">'
);

newAdminContent = newAdminContent.replace(
  '<Wrench className="w-4 h-4 text-muted-foreground" /> Admin Actions',
  '<Wrench className="w-4 h-4 text-[#0969da]" /> Administrative Actions'
);

newAdminContent = newAdminContent.replace(
  '<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">',
  '<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">'
);

// Update labels
newAdminContent = newAdminContent.replaceAll(
  '<label className="text-[10px] text-muted-foreground font-semibold">',
  '<label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">'
);

// Update selects
newAdminContent = newAdminContent.replaceAll(
  'className="w-full text-xs bg-background border border-border rounded-lg p-2 focus:ring-1 focus:ring-blue-500"',
  'className="w-full text-sm bg-background border border-border rounded-xl p-3 focus:ring-2 focus:ring-[#0969da] focus:border-[#0969da] transition-all"'
);


// Update Internal Municipal Comments header
newAdminContent = newAdminContent.replace(
  '<h4 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 leading-none pl-1">',
  '<h4 className="text-[13px] font-bold text-foreground tracking-wider uppercase flex items-center gap-2 leading-none pl-1">'
);

newAdminContent = newAdminContent.replace(
  '<FileText className="w-4 h-4 text-muted-foreground" /> Internal Municipal Comments',
  '<FileText className="w-4 h-4 text-[#0969da]" /> Internal Municipal Comments'
);


fs.writeFileSync(adminPath, newAdminContent);
console.log("AdminDashboardClient.tsx patched successfully.");
