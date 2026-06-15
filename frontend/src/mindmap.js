import { formatDate, escapeHtml } from './config.js';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const HORIZONTAL_GAP = 60;
const VERTICAL_GAP = 20;
const MAX_VISIBLE_NODES = 100;
const AGGREGATION_THRESHOLD = 5;
const MAX_DEPTH_BEFORE_COLLAPSE = 3;

export class CommentMindMap {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            onNodeClick: options.onNodeClick || (() => {}),
            onNodeDoubleClick: options.onNodeDoubleClick || (() => {}),
            ...options
        };

        this.treeData = [];
        this.flatNodes = [];
        this.viewport = { x: 0, y: 0, scale: 1 };
        this.collapsedNodes = new Set();
        this.aggregatedNodes = new Map();
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.viewportStart = { x: 0, y: 0 };
        this.rootPost = null;
        this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="mindmap-wrapper">
                <div class="mindmap-toolbar">
                    <button class="mindmap-toolbar-btn" data-action="zoom-in" title="放大">
                        <i class="bi bi-zoom-in"></i>
                    </button>
                    <button class="mindmap-toolbar-btn" data-action="zoom-out" title="缩小">
                        <i class="bi bi-zoom-out"></i>
                    </button>
                    <button class="mindmap-toolbar-btn" data-action="reset" title="重置视图">
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                    <button class="mindmap-toolbar-btn" data-action="expand-all" title="展开全部">
                        <i class="bi bi-chevron-double-down"></i>
                    </button>
                    <button class="mindmap-toolbar-btn" data-action="collapse-all" title="折叠全部">
                        <i class="bi bi-chevron-double-up"></i>
                    </button>
                    <span class="mindmap-toolbar-separator"></span>
                    <span class="mindmap-zoom-level">100%</span>
                    <span class="mindmap-node-count">节点: 0</span>
                </div>
                <div class="mindmap-canvas-container" id="mindmap-canvas-container">
                    <svg class="mindmap-svg" id="mindmap-svg">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                                    refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8"/>
                            </marker>
                            <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
                            </filter>
                        </defs>
                        <g class="mindmap-viewport" id="mindmap-viewport">
                            <g class="mindmap-links" id="mindmap-links"></g>
                            <g class="mindmap-nodes" id="mindmap-nodes"></g>
                        </g>
                    </svg>
                </div>
                <div class="mindmap-legend">
                    <span class="legend-item"><span class="legend-dot legend-root"></span> 帖子</span>
                    <span class="legend-item"><span class="legend-dot legend-comment"></span> 评论</span>
                    <span class="legend-item"><span class="legend-dot legend-reply"></span> 回复</span>
                </div>
            </div>
        `;

        this.svg = this.container.querySelector('#mindmap-svg');
        this.viewportGroup = this.container.querySelector('#mindmap-viewport');
        this.linksGroup = this.container.querySelector('#mindmap-links');
        this.nodesGroup = this.container.querySelector('#mindmap-nodes');
        this.canvasContainer = this.container.querySelector('#mindmap-canvas-container');
        this.zoomLevelEl = this.container.querySelector('.mindmap-zoom-level');
        this.nodeCountEl = this.container.querySelector('.mindmap-node-count');

        this.bindEvents();
    }

    bindEvents() {
        const container = this.canvasContainer;

        container.addEventListener('mousedown', (e) => {
            if (e.target.closest('.mindmap-node')) return;
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.viewportStart = { ...this.viewport };
            container.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.dragStart.x;
            const dy = e.clientY - this.dragStart.y;
            this.viewport.x = this.viewportStart.x + dx / this.viewport.scale;
            this.viewport.y = this.viewportStart.y + dy / this.viewport.scale;
            this.updateTransform();
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            container.style.cursor = '';
        });

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoomAt(e.clientX, e.clientY, delta);
        }, { passive: false });

        this.container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleToolbarAction(action);
            });
        });

        let lastTouchDistance = 0;
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                lastTouchDistance = this.getTouchDistance(e.touches);
            } else if (e.touches.length === 1 && !e.target.closest('.mindmap-node')) {
                this.isDragging = true;
                this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                this.viewportStart = { ...this.viewport };
            }
        });

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const distance = this.getTouchDistance(e.touches);
                const scale = distance / lastTouchDistance;
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                this.zoomAt(centerX, centerY, scale);
                lastTouchDistance = distance;
            } else if (e.touches.length === 1 && this.isDragging) {
                const dx = e.touches[0].clientX - this.dragStart.x;
                const dy = e.touches[0].clientY - this.dragStart.y;
                this.viewport.x = this.viewportStart.x + dx / this.viewport.scale;
                this.viewport.y = this.viewportStart.y + dy / this.viewport.scale;
                this.updateTransform();
            }
        });

        container.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }

    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    zoomAt(clientX, clientY, factor) {
        const newScale = Math.max(0.3, Math.min(3, this.viewport.scale * factor));
        if (newScale === this.viewport.scale) return;

        const rect = this.canvasContainer.getBoundingClientRect();
        const x = (clientX - rect.left) / this.viewport.scale - this.viewport.x;
        const y = (clientY - rect.top) / this.viewport.scale - this.viewport.y;

        this.viewport.x = (clientX - rect.left) / newScale - x;
        this.viewport.y = (clientY - rect.top) / newScale - y;
        this.viewport.scale = newScale;

        this.updateTransform();
    }

    updateTransform() {
        this.viewportGroup.setAttribute('transform', 
            `translate(${this.viewport.x * this.viewport.scale}, ${this.viewport.y * this.viewport.scale}) scale(${this.viewport.scale})`);
        this.zoomLevelEl.textContent = Math.round(this.viewport.scale * 100) + '%';
        this.renderVisibleNodes();
    }

    handleToolbarAction(action) {
        switch (action) {
            case 'zoom-in':
                this.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.2);
                break;
            case 'zoom-out':
                this.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 0.8);
                break;
            case 'reset':
                this.resetView();
                break;
            case 'expand-all':
                this.expandAll();
                break;
            case 'collapse-all':
                this.collapseAll();
                break;
        }
    }

    setData(treeData, postData) {
        this.treeData = treeData || [];
        this.rootPost = postData;
        this.collapsedNodes.clear();
        this.aggregatedNodes.clear();

        this.autoCollapseDeepNodes();
        this.calculateLayout();
        this.centerView();
        this.render();
    }

    autoCollapseDeepNodes() {
        const processNode = (node, depth) => {
            if (depth > MAX_DEPTH_BEFORE_COLLAPSE && node.children && node.children.length > 0) {
                this.collapsedNodes.add(node.id);
            }
            if (node.children) {
                node.children.forEach(child => processNode(child, depth + 1));
            }
        };
        this.treeData.forEach(node => processNode(node, 1));
    }

    calculateLayout() {
        this.flatNodes = [];
        let currentY = 0;

        const rootNode = {
            id: 'root',
            type: 'root',
            author_name: this.rootPost?.author_name || '帖子',
            content: this.rootPost?.title || '帖子',
            content_summary: (this.rootPost?.title || '帖子').substring(0, 50),
            created_at: this.rootPost?.created_at || new Date().toISOString(),
            children: this.treeData,
            descendant_count: this.treeData.reduce((sum, n) => sum + 1 + (n.descendant_count || 0), 0),
            x: 0,
            y: 0,
            depth: 0,
            width: NODE_WIDTH + 20,
            height: NODE_HEIGHT + 10,
            isRoot: true
        };

        this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

        const layoutNode = (node, depth, startY) => {
            node.depth = depth;
            node.x = depth * (NODE_WIDTH + HORIZONTAL_GAP);
            node.y = startY;
            node.width = NODE_WIDTH;
            node.height = NODE_HEIGHT;

            if (!node.isRoot) {
                this.flatNodes.push(node);
            }

            this.bounds.minX = Math.min(this.bounds.minX, node.x);
            this.bounds.maxX = Math.max(this.bounds.maxX, node.x + node.width);
            this.bounds.minY = Math.min(this.bounds.minY, node.y);
            this.bounds.maxY = Math.max(this.bounds.maxY, node.y + node.height);

            const isCollapsed = this.collapsedNodes.has(node.id);
            const visibleChildren = isCollapsed ? [] : (node.children || []);
            const childCount = visibleChildren.length;

            if (childCount === 0) {
                return node.height + VERTICAL_GAP;
            }

            const { groups, aggregated } = this.getChildGroups(visibleChildren, node.id);
            
            if (aggregated) {
                node.aggregated = aggregated;
                node.aggregatedCount = aggregated.count;
            }

            let totalHeight = 0;
            let childY = startY;
            const centerOffset = (node.height - VERTICAL_GAP) / 2;

            groups.forEach((group, groupIndex) => {
                if (group.isAggregation) {
                    const aggNode = {
                        id: `agg-${node.id}-${groupIndex}`,
                        type: 'aggregation',
                        parent_id: node.id,
                        count: group.count,
                        children: group.children,
                        depth: depth + 1,
                        x: (depth + 1) * (NODE_WIDTH + HORIZONTAL_GAP),
                        y: childY + centerOffset,
                        width: NODE_WIDTH,
                        height: NODE_HEIGHT
                    };
                    this.flatNodes.push(aggNode);
                    if (!node.aggregatedNodes) node.aggregatedNodes = [];
                    node.aggregatedNodes.push(aggNode);
                    totalHeight += NODE_HEIGHT + VERTICAL_GAP;
                    childY += NODE_HEIGHT + VERTICAL_GAP;
                } else {
                    const childHeight = layoutNode(group.node, depth + 1, childY);
                    totalHeight += childHeight;
                    childY += childHeight;
                }
            });

            return Math.max(node.height + VERTICAL_GAP, totalHeight);
        };

        const totalHeight = layoutNode(rootNode, 0, 0);
        this.rootNode = rootNode;
        this.flatNodes.unshift(rootNode);
        this.totalHeight = totalHeight;
    }

    getChildGroups(children, parentId) {
        if (children.length <= AGGREGATION_THRESHOLD) {
            return {
                groups: children.map(node => ({ node, isAggregation: false })),
                aggregated: null
            };
        }

        const visibleCount = AGGREGATION_THRESHOLD - 1;
        const groups = [];

        for (let i = 0; i < visibleCount; i++) {
            groups.push({ node: children[i], isAggregation: false });
        }

        const remainingChildren = children.slice(visibleCount);
        groups.push({
            isAggregation: true,
            count: remainingChildren.length,
            children: remainingChildren
        });

        return {
            groups,
            aggregated: {
                count: remainingChildren.length,
                children: remainingChildren
            }
        };
    }

    centerView() {
        const rect = this.canvasContainer.getBoundingClientRect();
        const contentWidth = this.bounds.maxX - this.bounds.minX;
        const contentHeight = this.bounds.maxY - this.bounds.minY;

        const scaleX = (rect.width - 40) / (contentWidth + NODE_WIDTH);
        const scaleY = (rect.height - 40) / (contentHeight + NODE_HEIGHT);
        this.viewport.scale = Math.min(1, Math.min(scaleX, scaleY));

        this.viewport.x = (rect.width - contentWidth * this.viewport.scale) / 2 - this.bounds.minX * this.viewport.scale;
        this.viewport.y = (rect.height - contentHeight * this.viewport.scale) / 2 - this.bounds.minY * this.viewport.scale;

        this.updateTransform();
    }

    resetView() {
        this.centerView();
    }

    expandAll() {
        this.collapsedNodes.clear();
        this.aggregatedNodes.clear();
        this.calculateLayout();
        this.render();
    }

    collapseAll() {
        this.flatNodes.forEach(node => {
            if (node.children && node.children.length > 0 && !node.isRoot) {
                this.collapsedNodes.add(node.id);
            }
        });
        this.calculateLayout();
        this.render();
    }

    toggleNode(nodeId) {
        if (this.collapsedNodes.has(nodeId)) {
            this.collapsedNodes.delete(nodeId);
        } else {
            this.collapsedNodes.add(nodeId);
        }
        this.calculateLayout();
        this.render();
    }

    expandAggregation(aggNode) {
        const parentNode = this.findNodeById(aggNode.parent_id);
        if (parentNode) {
            this.aggregatedNodes.set(aggNode.parent_id, 
                (this.aggregatedNodes.get(aggNode.parent_id) || 0) + aggNode.count);
            this.calculateLayout();
            this.render();
        }
    }

    findNodeById(id) {
        const search = (nodes) => {
            for (const node of nodes) {
                if (node.id === id) return node;
                if (node.children) {
                    const found = search(node.children);
                    if (found) return found;
                }
                if (node.aggregatedNodes) {
                    for (const agg of node.aggregatedNodes) {
                        if (agg.children) {
                            const found = search(agg.children);
                            if (found) return found;
                        }
                    }
                }
            }
            return null;
        };
        return search([this.rootNode]);
    }

    getVisibleNodes() {
        if (this.flatNodes.length <= MAX_VISIBLE_NODES) {
            return this.flatNodes;
        }

        const rect = this.canvasContainer.getBoundingClientRect();
        const viewLeft = -this.viewport.x;
        const viewTop = -this.viewport.y;
        const viewRight = viewLeft + rect.width / this.viewport.scale;
        const viewBottom = viewTop + rect.height / this.viewport.scale;

        const padding = NODE_WIDTH;

        return this.flatNodes.filter(node => {
            return node.x + node.width + padding >= viewLeft &&
                   node.x - padding <= viewRight &&
                   node.y + node.height + padding >= viewTop &&
                   node.y - padding <= viewBottom;
        });
    }

    render() {
        this.renderLinks();
        this.renderVisibleNodes();
        this.updateNodeCount();
    }

    renderLinks() {
        const links = [];

        const drawLinks = (parentNode) => {
            const isCollapsed = this.collapsedNodes.has(parentNode.id);
            const children = isCollapsed ? [] : (parentNode.children || []);

            children.forEach(child => {
                links.push(this.createLinkPath(parentNode, child));
                drawLinks(child);
            });

            if (parentNode.aggregatedNodes) {
                parentNode.aggregatedNodes.forEach(aggNode => {
                    links.push(this.createLinkPath(parentNode, aggNode));
                    aggNode.children?.forEach(child => {
                        links.push(this.createLinkPath(aggNode, child));
                    });
                });
            }
        };

        drawLinks(this.rootNode);

        this.linksGroup.innerHTML = links.join('');
    }

    createLinkPath(from, to) {
        const fromX = from.x + from.width;
        const fromY = from.y + from.height / 2;
        const toX = to.x;
        const toY = to.y + to.height / 2;

        const midX = (fromX + toX) / 2;
        const d = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

        return `<path class="mindmap-link" d="${d}" marker-end="url(#arrowhead)"/>`;
    }

    renderVisibleNodes() {
        const visibleNodes = this.getVisibleNodes();

        const nodeElements = visibleNodes.map(node => {
            return this.createNodeElement(node);
        }).join('');

        this.nodesGroup.innerHTML = nodeElements;

        this.nodesGroup.querySelectorAll('.mindmap-node').forEach(el => {
            const nodeId = el.dataset.nodeId;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const node = this.flatNodes.find(n => String(n.id) === String(nodeId));
                if (node) {
                    this.options.onNodeClick(node);
                }
            });

            el.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const node = this.flatNodes.find(n => String(n.id) === String(nodeId));
                if (node && node.type !== 'aggregation' && node.children && node.children.length > 0) {
                    this.toggleNode(nodeId);
                } else if (node && node.type === 'aggregation') {
                    this.expandAggregation(node);
                }
            });

            const expandBtn = el.querySelector('.node-expand-btn');
            if (expandBtn) {
                expandBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const node = this.flatNodes.find(n => String(n.id) === String(nodeId));
                    if (node && node.type !== 'aggregation' && node.children && node.children.length > 0) {
                        this.toggleNode(nodeId);
                    }
                });
            }

            const aggBtn = el.querySelector('.aggregation-btn');
            if (aggBtn) {
                aggBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const node = this.flatNodes.find(n => String(n.id) === String(nodeId));
                    if (node && node.type === 'aggregation') {
                        this.expandAggregation(node);
                    }
                });
            }
        });
    }

    createNodeElement(node) {
        if (node.type === 'aggregation') {
            return this.createAggregationNode(node);
        }

        const isRoot = node.isRoot;
        const hasChildren = node.children && node.children.length > 0;
        const isCollapsed = this.collapsedNodes.has(node.id);
        const nodeClass = isRoot ? 'mindmap-node root-node' : 
                         node.depth === 1 ? 'mindmap-node comment-node' : 
                         'mindmap-node reply-node';

        const descendantCount = node.descendant_count || 0;

        return `
            <g class="${nodeClass}" data-node-id="${node.id}" 
               transform="translate(${node.x}, ${node.y})" filter="url(#node-shadow)">
                <rect class="node-bg" width="${node.width}" height="${node.height}" rx="8"/>
                <foreignObject width="${node.width}" height="${node.height}">
                    <div xmlns="http://www.w3.org/1999/xhtml" class="node-content">
                        <div class="node-header">
                            <span class="node-author">${escapeHtml(node.author_name)}</span>
                            ${descendantCount > 0 ? `<span class="node-badge">${descendantCount}</span>` : ''}
                        </div>
                        <div class="node-summary">${escapeHtml(node.content_summary || node.content.substring(0, 50))}</div>
                        <div class="node-meta">
                            <i class="bi bi-clock"></i>
                            ${formatDate(node.created_at)}
                        </div>
                    </div>
                </foreignObject>
                ${hasChildren ? `
                    <g class="node-expand-btn" transform="translate(${node.width - 5}, ${node.height / 2})">
                        <circle r="10" class="expand-btn-bg"/>
                        <text class="expand-btn-icon" text-anchor="middle" dominant-baseline="central">
                            ${isCollapsed ? '+' : '−'}
                        </text>
                    </g>
                ` : ''}
            </g>
        `;
    }

    createAggregationNode(node) {
        return `
            <g class="mindmap-node aggregation-node" data-node-id="${node.id}"
               transform="translate(${node.x}, ${node.y})" filter="url(#node-shadow)">
                <rect class="node-bg aggregation-bg" width="${node.width}" height="${node.height}" rx="8"/>
                <foreignObject width="${node.width}" height="${node.height}">
                    <div xmlns="http://www.w3.org/1999/xhtml" class="node-content aggregation-content">
                        <div class="aggregation-icon">
                            <i class="bi bi-layers"></i>
                        </div>
                        <div class="aggregation-text">
                            还有 <strong>+${node.count}</strong> 条回复
                        </div>
                        <div class="aggregation-hint">双击展开</div>
                    </div>
                </foreignObject>
                <g class="aggregation-btn" transform="translate(${node.width - 5}, ${node.height / 2})">
                    <circle r="10" class="expand-btn-bg aggregation-btn-bg"/>
                    <text class="expand-btn-icon" text-anchor="middle" dominant-baseline="central">+</text>
                </g>
            </g>
        `;
    }

    updateNodeCount() {
        const totalNodes = this.flatNodes.length;
        const visibleNodes = this.getVisibleNodes().length;
        this.nodeCountEl.textContent = `节点: ${visibleNodes}/${totalNodes}`;
    }

    highlightNode(commentId) {
        const node = this.flatNodes.find(n => Number(n.id) === Number(commentId));
        if (!node) return;

        this.viewport.x = -node.x + (this.canvasContainer.getBoundingClientRect().width / this.viewport.scale - node.width) / 2;
        this.viewport.y = -node.y + (this.canvasContainer.getBoundingClientRect().height / this.viewport.scale - node.height) / 2;
        this.updateTransform();

        const nodeEl = this.nodesGroup.querySelector(`[data-node-id="${commentId}"]`);
        if (nodeEl) {
            nodeEl.classList.add('highlighted');
            setTimeout(() => nodeEl.classList.remove('highlighted'), 2000);
        }
    }

    destroy() {
        this.container.innerHTML = '';
        this.treeData = [];
        this.flatNodes = [];
    }
}
