/**
 * case-links.js — "Linked cases" panel of a case.
 *
 * Folded by default: only the title, the count, the "new link" button and the fold
 * button. Unfolded: the linked cases 4 per page (title, id, status, tasks, deadline and
 * the start of the description). Hovering (or focusing) a case unfolds its details
 * (whole description, organisation, dates, assigned people); a click opens the case.
 * People assigned to the case's tasks are drawn with user-chip.js.
 * The folded / unfolded state is remembered in localStorage.
 *
 * Props:
 *   links       Array   — Case.to_link_json() of the linked cases
 *   statuses    Array   — status_info.status ({id, name, bootstrap_style}), for the badge
 *   removable   Boolean — show the "remove the link" button
 *   canLink     Boolean — show the "new link" button (opens the #add_new_link modal)
 * Emits:
 *   remove(link)
 */
import user_chip from './user-chip.js'
const { ref, computed, watch } = Vue

const PER_PAGE = 4
const OPEN_KEY = 'flowintel_case_links_open'
const SHORT_DESC = 110

function read_open() {
    try { return localStorage.getItem(OPEN_KEY) === '1' } catch (e) { return false }
}

export default {
    name: 'CaseLinks',
    delimiters: ['[[', ']]'],
    props: {
        links: { type: Array, default: () => [] },
        statuses: { type: Array, default: () => [] },
        removable: { type: Boolean, default: false },
        canLink: { type: Boolean, default: false },
    },
    components: { user_chip },
    emits: ['remove'],
    setup(props) {
        const open = ref(read_open())
        function toggle() {
            open.value = !open.value
            try { localStorage.setItem(OPEN_KEY, open.value ? '1' : '0') } catch (e) { /* private window */ }
        }

        const page = ref(0)
        const pages = computed(() => Math.max(1, Math.ceil(props.links.length / PER_PAGE)))
        const shown = computed(() => props.links.slice(page.value * PER_PAGE, page.value * PER_PAGE + PER_PAGE))
        const range = computed(() => {
            const from = page.value * PER_PAGE + 1
            return `${from}–${Math.min(from + PER_PAGE - 1, props.links.length)} / ${props.links.length}`
        })
        // a removed link can leave the last page empty
        watch(() => props.links.length, () => { if (page.value > pages.value - 1) page.value = pages.value - 1 })

        function go(link) { window.location.href = '/case/' + link.id }
        function status_of(l) { return props.statuses.find(s => s.id === l.status_id) || null }
        function progress(l) { return l.tasks_total ? Math.round(l.tasks_closed / l.tasks_total * 100) : 0 }
        function day(d) { return d ? String(d).slice(0, 10) : '' }
        function overdue(l) {
            return !!l.deadline && !l.completed && new Date(String(l.deadline).replace(' ', 'T')) < new Date()
        }
        function plain(l) { return (l.description || '').replace(/[#*_`>\[\]]/g, '').replace(/\s+/g, ' ').trim() }
        function short_desc(l) {
            const d = plain(l)
            return d.length > SHORT_DESC ? d.slice(0, SHORT_DESC).trimEnd() + '…' : d
        }
        function has_more(l) { return plain(l).length > SHORT_DESC }

        return { open, toggle, page, pages, shown, range, go, status_of, progress, day, overdue,
                 plain, short_desc, has_more }
    },
    template: `
    <div class="clk">
        <div class="clk-head">
            <button type="button" class="clk-fold" :aria-expanded="open" @click="toggle"
                    :title="open ? 'Hide the linked cases' : 'Show the linked cases'">
                <h6 class="section-title mb-0"><i class="fa-solid fa-link fa-sm me-2"></i>Linked cases</h6>
                <span class="badge text-bg-secondary">[[ links.length ]]</span>
            </button>
            <div class="clk-actions">
                <button v-if="canLink" type="button" class="btn btn-primary btn-sm" title="New link"
                        data-bs-toggle="modal" data-bs-target="#add_new_link">
                    <i class="fa-solid fa-paperclip fa-sm"></i>+
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm clk-chev-btn" :aria-expanded="open" @click="toggle"
                        :title="open ? 'Hide the linked cases' : 'Show the linked cases'">
                    <i :class="['fa-solid fa-chevron-down clk-chev', { 'is-open': open }]"></i>
                </button>
            </div>
        </div>

        <template v-if="open">
            <hr class="fading-line-2 mt-2 mb-2">
            <div v-if="!links.length" class="text-muted small fst-italic">No linked case.</div>
            <template v-else>
                <div class="clk-list">
                    <article v-for="l in shown" :key="l.id" :class="['clc', { 'is-done': l.completed, 'is-overdue': overdue(l) }]"
                             role="link" tabindex="0" :aria-label="'Open case #' + l.id + ': ' + l.title"
                             @click="go(l)" @keydown.enter="go(l)">
                        <div class="clc-main">
                            <div class="clc-line">
                                <span class="clc-title">[[ l.title ]]</span>
                                <span class="clc-id">#[[ l.id ]]</span>
                                <i v-if="l.is_private" class="fa-solid fa-lock clc-lock" title="Private case"></i>
                                <span v-if="status_of(l)" :class="'badge rounded-pill text-bg-' + (status_of(l).bootstrap_style || 'secondary')">[[ status_of(l).name ]]</span>
                                <span class="clc-facts">
                                    <span v-if="l.users && l.users.length" class="clc-users" @click.stop>
                                        <user_chip v-for="u in l.users.slice(0, 3)" :key="u.id" :user="u" variant="avatar" size="sm"></user_chip>
                                        <span v-if="l.users.length > 3" class="clc-users-more">+[[ l.users.length - 3 ]]</span>
                                    </span>
                                    <span v-if="l.tasks_total" class="clc-progress" :title="l.tasks_closed + ' / ' + l.tasks_total + ' tasks done'">
                                        <span class="clc-bar"><span :style="{ width: progress(l) + '%' }"></span></span>[[ l.tasks_closed ]]/[[ l.tasks_total ]]
                                    </span>
                                    <span v-else-if="l.tasks_total === 0">No task</span>
                                    <span v-if="l.deadline" :class="['clc-due', { 'is-late': overdue(l) }]" :title="'Deadline: ' + day(l.deadline)">
                                        <i :class="overdue(l) ? 'fa-solid fa-triangle-exclamation' : 'fa-regular fa-calendar'"></i>[[ day(l.deadline) ]]
                                    </span>
                                </span>
                            </div>
                            <div class="clc-desc">
                                <span v-if="plain(l)">[[ short_desc(l) ]]</span>
                                <span v-else class="fst-italic">No description</span>
                            </div>
                            <!-- unfolds on hover / focus -->
                            <div class="clc-more">
                                <div class="clc-more-inner">
                                    <p v-if="has_more(l)" class="clc-full">[[ plain(l) ]]</p>
                                    <dl class="clc-meta">
                                        <template v-if="l.owner_org"><dt>Organisation</dt><dd>[[ l.owner_org ]]</dd></template>
                                        <template v-if="l.creation_date"><dt>Created</dt><dd>[[ l.creation_date ]]</dd></template>
                                        <template v-if="l.last_modif"><dt>Last modified</dt><dd>[[ l.last_modif ]]</dd></template>
                                        <template v-if="l.deadline"><dt>Deadline</dt><dd>[[ l.deadline ]]</dd></template>
                                        <template v-if="l.completed && l.finish_date"><dt>Finished</dt><dd>[[ l.finish_date ]]</dd></template>
                                        <template v-if="l.tasks_total"><dt>Tasks</dt><dd>[[ l.tasks_closed ]] done / [[ l.tasks_total ]] ([[ progress(l) ]]%)</dd></template>
                                    </dl>
                                    <div v-if="l.users && l.users.length" class="clc-people" @click.stop>
                                        <user_chip v-for="u in l.users" :key="u.id" :user="u" size="sm"></user_chip>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button v-if="removable" type="button" class="clc-remove" @click.stop="$emit('remove', l)"
                                title="Remove the link to this case" aria-label="Remove the link">
                            <i class="fa-solid fa-link-slash"></i>
                        </button>
                    </article>
                </div>
                <div v-if="pages > 1" class="clk-pager">
                    <button type="button" class="clk-arrow" :disabled="page === 0" @click="page--" aria-label="Previous linked cases">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <span v-for="i in pages" :key="i" :class="['clk-dot', { 'is-active': i - 1 === page }]" @click="page = i - 1" :title="'Page ' + i"></span>
                    <button type="button" class="clk-arrow" :disabled="page >= pages - 1" @click="page++" aria-label="Next linked cases">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <span class="clk-range">[[ range ]]</span>
                </div>
            </template>
        </template>
    </div>
    `
}
