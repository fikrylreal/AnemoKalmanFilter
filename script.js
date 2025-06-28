// Firebase Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Global Variables
let members = [];
let selectedMember = null;
let currentZoom = 1;
let editMode = false;

// DOM Elements
const chartContainer = document.getElementById('chart-container');
const profileView = document.getElementById('profileView');
const memberModal = document.getElementById('memberModal');
const memberForm = document.getElementById('memberForm');
const modalTitle = document.getElementById('modalTitle');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Handle back button when viewing profile
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('back-btn')) {
            showTreeView();
        }
    });
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
        const memberId = getMemberIdFromUrl();
        if (memberId) {
            showProfileView(memberId);
        } else {
            showTreeView();
        }
    });
}

// Data Loading
async function loadData() {
    try {
        const snapshot = await db.collection('members').get();
        members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const memberId = getMemberIdFromUrl();
        if (memberId) {
            showProfileView(memberId);
        } else {
            drawChart();
        }
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Failed to load family data. Please try again.");
    }
}

// Chart Drawing
function drawChart() {
    $('#chart-container').empty();
    
    const rootMembers = members.filter(member => !member.parentId);
    
    if (rootMembers.length === 0) {
        chartContainer.innerHTML = `
            <div class="empty-state">
                <h3>No Family Members Found</h3>
                <p>Get started by adding your first family member!</p>
                <button class="btn btn-add" onclick="showAddForm()">Add First Member</button>
            </div>
        `;
        return;
    }
    
    const chartData = {
        name: "Family Tree",
        children: rootMembers.map(member => buildTreeNode(member))
    };
    
    $('#chart-container').orgchart({
        data: chartData,
        nodeContent: 'title',
        verticalDepth: 5,
        pan: true,
        zoom: true,
        createNode: function($node, data) {
            $node.on('click', () => showProfileView(data.id));
        }
    });
    
    // Apply current zoom level
    $('#chart-container').css('transform', `scale(${currentZoom})`);
}

function buildTreeNode(member) {
    const node = {
        id: member.id,
        name: member.name,
        title: `
            <div class="title">${member.name}</div>
            <span class="relationship">${member.relationship || 'Family'}</span>
            <div class="generation-mark">G${calculateGeneration(member.id)}</div>
        `,
        relationship: member.relationship
    };
    
    const children = members.filter(m => m.parentId === member.id);
    if (children.length > 0) {
        node.children = children.map(child => buildTreeNode(child));
    }
    
    return node;
}

function calculateGeneration(memberId) {
    let generation = 1;
    let currentMember = members.find(m => m.id === memberId);
    
    while (currentMember?.parentId) {
        generation++;
        currentMember = members.find(m => m.id === currentMember.parentId);
    }
    
    return generation;
}

// Profile View
function showProfileView(memberId) {
    const member = members.find(m => m.id === memberId);
    if (!member) {
        alert("Member not found");
        return;
    }
    
    selectedMember = member;
    updateUrl(memberId);
    
    // Build profile HTML
    profileView.innerHTML = `
        <button class="back-btn" onclick="showTreeView()">
            ← Back to Tree
        </button>
        
        <div class="profile-header">
            <img src="${member.photoURL || 'assets/placeholder.jpg'}" 
                 alt="${member.name}" 
                 class="profile-photo"
                 onerror="this.src='assets/placeholder.jpg'">
            <div class="profile-info">
                <h1 class="profile-name">${member.name}</h1>
                <span class="profile-relationship">${member.relationship || 'Family Member'}</span>
            </div>
        </div>
        
        <div class="profile-details">
            <div class="detail-card">
                <span class="detail-label">Birth Date</span>
                <span class="detail-value">${member.birthDate || 'Not specified'}</span>
            </div>
            
            <div class="detail-card">
                <span class="detail-label">Generation</span>
                <span class="detail-value">${calculateGeneration(member.id)}</span>
            </div>
            
            ${member.parentId ? `
            <div class="detail-card">
                <span class="detail-label">Parent</span>
                <span class="detail-value">
                    ${getMemberName(member.parentId) || 'Unknown'}
                </span>
            </div>
            ` : ''}
            
            <div class="detail-card bio-card">
                <span class="detail-label">Bio</span>
                <p class="detail-value">${member.bio || 'No biography available.'}</p>
            </div>
        </div>
        
        <div class="profile-actions">
            <button class="btn btn-edit" onclick="editMember('${member.id}')">
                Edit Profile
            </button>
            <button class="btn btn-delete" onclick="confirmDelete('${member.id}')">
                Delete
            </button>
        </div>
    `;
    
    // Show profile view
    chartContainer.style.display = 'none';
    profileView.style.display = 'block';
}

function showTreeView() {
    updateUrl();
    profileView.style.display = 'none';
    chartContainer.style.display = 'block';
}

// Member CRUD Operations
function showAddForm(parentId = null) {
    editMode = false;
    modalTitle.textContent = "Add Family Member";
    memberForm.reset();
    
    // Populate parent dropdown
    const parentSelect = document.getElementById('parent');
    parentSelect.innerHTML = '<option value="">None (Root Member)</option>';
    
    members.forEach(member => {
        parentSelect.innerHTML += `<option value="${member.id}" ${parentId === member.id ? 'selected' : ''}>${member.name}</option>`;
    });
    
    memberModal.style.display = 'block';
}

function editMember(memberId) {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    
    editMode = true;
    selectedMember = member;
    modalTitle.textContent = "Edit Family Member";
    
    // Fill form with member data
    document.getElementById('name').value = member.name;
    document.getElementById('relationship').value = member.relationship || '';
    document.getElementById('parent').value = member.parentId || '';
    document.getElementById('birthDate').value = member.birthDate || '';
    document.getElementById('bio').value = member.bio || '';
    
    memberModal.style.display = 'block';
}

async function saveMember(event) {
    event.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const relationship = document.getElementById('relationship').value;
    const parentId = document.getElementById('parent').value || null;
    const birthDate = document.getElementById('birthDate').value;
    const bio = document.getElementById('bio').value.trim();
    
    const memberData = {
        name,
        relationship,
        parentId,
        birthDate: birthDate || null,
        bio: bio || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (editMode && selectedMember) {
            // Update existing member
            await db.collection('members').doc(selectedMember.id).update(memberData);
            
            // Update local data
            const index = members.findIndex(m => m.id === selectedMember.id);
            members[index] = { ...members[index], ...memberData };
            
            showSuccess("Member updated successfully!");
        } else {
            // Add new member
            const docRef = await db.collection('members').add({
                ...memberData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Add to local data
            members.push({ id: docRef.id, ...memberData });
            
            showSuccess("Member added successfully!");
        }
        
        closeModal();
        drawChart();
        
        // If we're viewing a profile, refresh it
        if (profileView.style.display === 'block' && selectedMember) {
            showProfileView(selectedMember.id);
        }
    } catch (error) {
        console.error("Error saving member:", error);
        showError("Failed to save member. Please try again.");
    }
}

async function confirmDelete(memberId) {
    if (!confirm("Are you sure you want to delete this member and all their descendants?")) {
        return;
    }
    
    try {
        // First check for descendants
        const hasDescendants = members.some(m => {
            let current = m;
            while (current.parentId) {
                if (current.parentId === memberId) return true;
                current = members.find(mem => mem.id === current.parentId);
                if (!current) break;
            }
            return false;
        });
        
        if (hasDescendants) {
            if (!confirm("This member has descendants. Delete them all?")) {
                return;
            }
        }
        
        // Delete from Firestore
        await db.collection('members').doc(memberId).delete();
        
        // Delete from local data
        members = members.filter(m => m.id !== memberId);
        
        // Delete any descendants
        const descendants = [];
        let toProcess = [memberId];
        
        while (toProcess.length > 0) {
            const currentId = toProcess.pop();
            const children = members.filter(m => m.parentId === currentId);
            
            for (const child of children) {
                await db.collection('members').doc(child.id).delete();
                descendants.push(child.id);
                toProcess.push(child.id);
            }
        }
        
        members = members.filter(m => !descendants.includes(m.id));
        
        showSuccess("Member deleted successfully!");
        showTreeView();
        drawChart();
    } catch (error) {
        console.error("Error deleting member:", error);
        showError("Failed to delete member. Please try again.");
    }
}

// Helper Functions
function getMemberName(memberId) {
    const member = members.find(m => m.id === memberId);
    return member ? member.name : null;
}

function updateUrl(memberId = null) {
    const url = memberId ? `?id=${memberId}` : window.location.pathname;
    window.history.pushState({}, '', url);
}

function getMemberIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function closeModal() {
    memberModal.style.display = 'none';
}

function showSuccess(message) {
    alert(message); // In a real app, you'd use a nicer notification system
}

function showError(message) {
    alert(message); // In a real app, you'd use a nicer notification system
}

// Zoom Functions
function zoomIn() {
    currentZoom += 0.1;
    if (currentZoom > 2) currentZoom = 2;
    $('#chart-container').css('transform', `scale(${currentZoom})`);
}

function zoomOut() {
    currentZoom -= 0.1;
    if (currentZoom < 0.5) currentZoom = 0.5;
    $('#chart-container').css('transform', `scale(${currentZoom})`);
}

function resetZoom() {
    currentZoom = 1;
    $('#chart-container').css('transform', 'scale(1)');
}

// Data Export
function exportData() {
    const data = {
        members: members,
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-tree-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}