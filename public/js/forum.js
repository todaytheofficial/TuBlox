// ============================================
// Forum JS
// ============================================

let forumCategories = [];
let currentCategory = 'all';
let currentForumPage = 1;
let currentPostOwnerId = null;
let currentPostId = null;

// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const path = location.pathname;
    
    if (path === '/TuForums') {
        initForumMain();
    } else if (path.match(/^\/TuForums\/\d+$/)) {
        initForumUser();
    } else if (path.match(/^\/TuForums\/\d+\/\d+$/)) {
        initForumPost();
    }
    
    // Char counters
    const titleInput = document.getElementById('post-title');
    const contentInput = document.getElementById('post-content');
    
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            document.getElementById('title-count').textContent = titleInput.value.length;
        });
    }
    
    if (contentInput) {
        contentInput.addEventListener('input', () => {
            document.getElementById('content-count').textContent = contentInput.value.length;
        });
    }
});

// ============================================
// Main Forum Page
// ============================================
async function initForumMain() {
    await loadCategories();
    await loadPosts();
}

async function loadCategories() {
    try {
        const res = await fetch('/api/forum/categories');
        const data = await res.json();
        
        if (data.success) {
            forumCategories = data.categories;
            renderCategories();
            populateCategorySelect();
        }
    } catch (err) {
        console.error('Load categories error:', err);
    }
}

function renderCategories() {
    const list = document.getElementById('category-list');
    if (!list) return;
    
    let html = `
        <div class="category-item ${currentCategory === 'all' ? 'active' : ''}" data-category="all" onclick="selectCategory('all')">
            <span class="category-icon">📋</span>
            <span class="category-name">All Posts</span>
        </div>
    `;
    
    for (const cat of forumCategories) {
        html += `
            <div class="category-item ${currentCategory === cat.id ? 'active' : ''}" data-category="${cat.id}" onclick="selectCategory('${cat.id}')">
                <span class="category-icon">${cat.icon}</span>
                <span class="category-name">${cat.name}</span>
            </div>
        `;
    }
    
    list.innerHTML = html;
}

function populateCategorySelect() {
    const select = document.getElementById('post-category');
    if (!select) return;
    
    let html = '';
    for (const cat of forumCategories) {
        html += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    }
    select.innerHTML = html;
}

function selectCategory(category) {
    currentCategory = category;
    currentForumPage = 1;
    renderCategories();
    loadPosts();
}

async function loadPosts() {
    const list = document.getElementById('posts-list');
    if (!list) return;
    
    list.innerHTML = '<div class="loading">Loading posts...</div>';
    
    const sort = document.getElementById('sort-select')?.value || 'newest';
    const search = document.getElementById('search-input')?.value || '';
    
    try {
        let url = `/api/forum/posts?page=${currentForumPage}&limit=15&sort=${sort}`;
        if (currentCategory !== 'all') url += `&category=${currentCategory}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.success && data.posts.length > 0) {
            list.innerHTML = data.posts.map(post => postCardHTML(post)).join('');
            renderForumPagination(data.pagination);
        } else {
            list.innerHTML = `
                <div class="forum-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <h3>No posts found</h3>
                    <p>Be the first to create a post!</p>
                </div>
            `;
            renderForumPagination(null);
        }
    } catch (err) {
        console.error('Load posts error:', err);
        list.innerHTML = '<div class="forum-empty"><h3>Error loading posts</h3></div>';
    }
}

function handleSearch(e) {
    if (e.key === 'Enter') {
        currentForumPage = 1;
        loadPosts();
    }
}

// ============================================
// User Posts Page
// ============================================
async function initForumUser() {
    const parts = location.pathname.split('/');
    const ownerId = parts[2];
    currentPostOwnerId = ownerId;
    
    await loadUserPosts(ownerId);
}

async function loadUserPosts(ownerId) {
    const header = document.getElementById('user-header');
    const list = document.getElementById('posts-list');
    
    try {
        const res = await fetch(`/api/forum/user/${ownerId}/posts?page=${currentForumPage}&limit=15`);
        const data = await res.json();
        
        if (data.success) {
            // Header
            const initial = data.user.username.charAt(0).toUpperCase();
            header.innerHTML = `
                <div class="user-avatar-large">${initial}</div>
                <h1>${data.user.username}'s Posts</h1>
                <p class="user-stats">${data.pagination.totalPosts} posts • <a href="/user/${data.user.odilId}">View Profile</a></p>
                <a href="/TuForums" class="btn btn-secondary" style="margin-top:16px;">← Back to Forums</a>
            `;
            
            // Posts
            if (data.posts.length > 0) {
                list.innerHTML = data.posts.map(post => postCardHTML(post)).join('');
                renderForumPagination(data.pagination, `loadUserPostsPage`);
            } else {
                list.innerHTML = `
                    <div class="forum-empty">
                        <h3>No posts yet</h3>
                        <p>This user hasn't created any posts.</p>
                    </div>
                `;
            }
        } else {
            header.innerHTML = '<h1>User not found</h1>';
            list.innerHTML = '';
        }
    } catch (err) {
        console.error('Load user posts error:', err);
        header.innerHTML = '<h1>Error loading user</h1>';
    }
}

function loadUserPostsPage(page) {
    currentForumPage = page;
    loadUserPosts(currentPostOwnerId);
}

// ============================================
// Post View Page
// ============================================
async function initForumPost() {
    const parts = location.pathname.split('/');
    currentPostOwnerId = parts[2];
    currentPostId = parts[3];
    
    await loadPost();
}

async function loadPost() {
    const container = document.getElementById('post-container');
    const repliesSection = document.getElementById('replies-section');
    
    try {
        const res = await fetch(`/api/forum/post/${currentPostOwnerId}/${currentPostId}`);
        const data = await res.json();
        
        if (data.success) {
            const post = data.post;
            const initial = post.authorName.charAt(0).toUpperCase();
            const category = forumCategories.find(c => c.id === post.category) || { icon: '💬', name: 'General' };
            const isLiked = currentUser && post.likes.includes(currentUser.odilId);
            const isOwner = currentUser && post.authorId === currentUser.odilId;
            
            container.innerHTML = `
                <a href="/TuForums" class="btn btn-ghost" style="margin-bottom:16px;">← Back to Forums</a>
                <div class="post-full">
                    <div class="post-full-header">
                        <div class="post-avatar">${initial}</div>
                        <div class="post-full-meta">
                            <h1 class="post-full-title">
                                ${post.isPinned ? '<span class="pin-icon">📌</span>' : ''}
                                ${post.isLocked ? '<span class="lock-icon">🔒</span>' : ''}
                                ${escapeHtml(post.title)}
                            </h1>
                            <div class="post-full-info">
                                <a href="/TuForums/${post.authorId}" class="post-author">${post.authorName}</a>
                                <span>•</span>
                                <span>${timeAgo(post.createdAt)}</span>
                                <span>•</span>
                                <span class="post-category-badge">${category.icon} ${category.name}</span>
                            </div>
                        </div>
                    </div>
                    <div class="post-full-content">${escapeHtml(post.content)}</div>
                    <div class="post-full-actions">
                        <button class="btn btn-secondary ${isLiked ? 'liked' : ''}" onclick="likePost(${post.postId})">
                            <svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="18" height="18">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                            <span id="like-count">${post.likes.length}</span>
                        </button>
                        <span class="post-stat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            ${post.views} views
                        </span>
                        <span class="post-stat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            ${post.replies} replies
                        </span>
                        ${isOwner ? `<button class="btn btn-danger" onclick="deletePost(${post.postId})">Delete</button>` : ''}
                    </div>
                </div>
            `;
            
            document.title = `TuBlox — ${post.title}`;
            
            // Replies
            repliesSection.style.display = 'block';
            
            if (post.isLocked) {
                document.getElementById('reply-form').style.display = 'none';
            }
            
            renderReplies(data.replies);
            
            // Load categories for display
            if (forumCategories.length === 0) {
                const catRes = await fetch('/api/forum/categories');
                const catData = await catRes.json();
                if (catData.success) forumCategories = catData.categories;
            }
            
        } else {
            container.innerHTML = `
                <div class="forum-empty">
                    <h3>Post not found</h3>
                    <a href="/TuForums" class="btn btn-primary">Back to Forums</a>
                </div>
            `;
        }
    } catch (err) {
        console.error('Load post error:', err);
        container.innerHTML = '<div class="forum-empty"><h3>Error loading post</h3></div>';
    }
}

function renderReplies(replies) {
    const list = document.getElementById('replies-list');
    if (!list) return;
    
    if (replies.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">No replies yet. Be the first!</p>';
        return;
    }
    
    list.innerHTML = replies.map(reply => {
        const initial = reply.authorName.charAt(0).toUpperCase();
        const isLiked = currentUser && reply.likes.includes(currentUser.odilId);
        
        return `
            <div class="reply-card">
                <div class="reply-header">
                    <div class="reply-avatar">${initial}</div>
                    <div class="post-meta">
                        <a href="/TuForums/${reply.authorId}" class="post-author">${reply.authorName}</a>
                        <div class="post-time">${timeAgo(reply.createdAt)}</div>
                    </div>
                </div>
                <div class="reply-content">${escapeHtml(reply.content)}</div>
                <div class="reply-actions">
                    <button class="btn btn-ghost ${isLiked ? 'liked' : ''}" onclick="likeReply(${reply.replyId})">
                        <svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span>${reply.likes.length}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// Actions
// ============================================
function openNewPostModal() {
    if (!currentUser) {
        toast('Please log in to create posts', 'error');
        return;
    }
    document.getElementById('new-post-modal').classList.add('active');
}

function closeNewPostModal() {
    document.getElementById('new-post-modal').classList.remove('active');
    document.getElementById('post-title').value = '';
    document.getElementById('post-content').value = '';
    document.getElementById('title-count').textContent = '0';
    document.getElementById('content-count').textContent = '0';
}

async function createPost() {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const category = document.getElementById('post-category').value;
    
    if (!title) {
        toast('Please enter a title', 'error');
        return;
    }
    
    if (!content) {
        toast('Please enter content', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/forum/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, category })
        });
        
        const data = await res.json();
        
        if (data.success) {
            toast('Post created!');
            closeNewPostModal();
            location.href = data.url;
        } else {
            toast(data.message, 'error');
        }
    } catch (err) {
        toast('Error creating post', 'error');
    }
}

async function postReply() {
    const content = document.getElementById('reply-content').value.trim();
    
    if (!content) {
        toast('Please enter a reply', 'error');
        return;
    }
    
    if (!currentUser) {
        toast('Please log in to reply', 'error');
        return;
    }
    
    try {
        const res = await fetch(`/api/forum/post/${currentPostId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        const data = await res.json();
        
        if (data.success) {
            toast('Reply posted!');
            document.getElementById('reply-content').value = '';
            loadPost();
        } else {
            toast(data.message, 'error');
        }
    } catch (err) {
        toast('Error posting reply', 'error');
    }
}

async function likePost(postId) {
    if (!currentUser) {
        toast('Please log in to like', 'error');
        return;
    }
    
    try {
        const res = await fetch(`/api/forum/post/${postId}/like`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('like-count').textContent = data.likesCount;
            const btn = event.target.closest('.btn');
            btn.classList.toggle('liked', data.liked);
        }
    } catch (err) {
        toast('Error', 'error');
    }
}

async function likeReply(replyId) {
    if (!currentUser) {
        toast('Please log in to like', 'error');
        return;
    }
    
    try {
        const res = await fetch(`/api/forum/reply/${replyId}/like`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            loadPost();
        }
    } catch (err) {
        toast('Error', 'error');
    }
}

async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
        const res = await fetch(`/api/forum/post/${postId}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            toast('Post deleted');
            location.href = '/TuForums';
        } else {
            toast(data.message, 'error');
        }
    } catch (err) {
        toast('Error deleting post', 'error');
    }
}

// ============================================
// Helpers
// ============================================
function postCardHTML(post) {
    const initial = post.authorName.charAt(0).toUpperCase();
    const category = forumCategories.find(c => c.id === post.category) || { icon: '💬', name: 'General' };
    
    return `
        <div class="post-card ${post.isPinned ? 'pinned' : ''}" onclick="location.href='/TuForums/${post.authorId}/${post.postId}'">
            <div class="post-card-header">
                <div class="post-avatar">${initial}</div>
                <div class="post-meta">
                    <a href="/TuForums/${post.authorId}" class="post-author" onclick="event.stopPropagation()">${post.authorName}</a>
                    <div class="post-time">${timeAgo(post.createdAt)}</div>
                </div>
                <span class="post-category-badge">${category.icon} ${category.name}</span>
            </div>
            <div class="post-title">
                ${post.isPinned ? '<span class="pin-icon">📌</span>' : ''}
                ${post.isLocked ? '<span class="lock-icon">🔒</span>' : ''}
                ${escapeHtml(post.title)}
            </div>
            <div class="post-preview">${escapeHtml(post.content)}</div>
            <div class="post-stats">
                <span class="post-stat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    ${post.likes.length}
                </span>
                <span class="post-stat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    ${post.replies}
                </span>
                <span class="post-stat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    ${post.views}
                </span>
            </div>
        </div>
    `;
}

function renderForumPagination(pagination, loadFn = 'goToForumPage') {
    const container = document.getElementById('pagination');
    if (!container || !pagination) {
        if (container) container.innerHTML = '';
        return;
    }
    
    const { currentPage, totalPages } = pagination;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    html += `<button class="pagination-btn" onclick="${loadFn}(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>←</button>`;
    
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="${loadFn}(${i})">${i}</button>`;
    }
    
    if (totalPages > 5) {
        html += `<span class="pagination-info">...</span>`;
        html += `<button class="pagination-btn" onclick="${loadFn}(${totalPages})">${totalPages}</button>`;
    }
    
    html += `<button class="pagination-btn" onclick="${loadFn}(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>→</button>`;
    
    container.innerHTML = html;
}

function goToForumPage(page) {
    currentForumPage = page;
    loadPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    
    return new Date(date).toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}