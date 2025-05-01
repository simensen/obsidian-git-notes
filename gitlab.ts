import { EventEmitter } from 'events';
import { Gitlab, EventSchema } from '@gitbeaker/rest';
import { CredentialsStore, DataSupports, DataTarget, Paths } from 'local'
import * as fs from 'fs'
import { dirname } from 'path'
import JSDB from '@small-tech/jsdb'

function generateDataTargetKey(dataTarget: dataTarget, rest: string): string
{
	const key = [dataTarget.type]
	if (dataTarget.host) {
		key.push(dataTarget.host)
	}

	return [...key, rest].join('-')
}

export class GitLabData implements DataSupports
{
    private eventEmitter: EventEmitter
    private credentialStore: CredentialsStore
    private paths: Paths
    constructor(
        eventEmitter: EventEmitter,
        paths: Paths,
        credentialStore: CredentialsStore,
    ) {
        this.eventEmitter = eventEmitter
        this.credentialStore = credentialStore
        this.paths = paths
    }

    supports(dataTarget: DataTarget): boolean {
        return dataTarget.type === 'gitlab'
    }

    getApiOptions(dataTarget: DataTarget): {host: string, token: string}
    {
        const hostname = dataTarget.hostname ?? 'gitlab.com'
        const host = dataTarget.port ? `https://${hostname}:${dataTarget.port}` : `https://${hostname}` 
        
        const token = this.credentialStore.getToken(dataTarget, '/')

        return {host, token}
    }

	async rebuildIssue(dataTarget: DataTarget, projectId, issueInternalId): Promise<EventSchema>
	{
        const paths = new Paths()
		const target_type = 'Issue'
		const target_iid = issueInternalId
    	
		const actualPath = `${projectId}/${target_type}/${target_iid}/Issue-${target_iid}.json`

		const jsonPath = paths.generateDataTargetStoragePath(dataTarget, actualPath)

		const jsonDir = dirname(jsonPath)


		const api = new Gitlab(this.getApiOptions(dataTarget))

		const issue = await api.Issues.show(issueInternalId, {projectId})

		try {
			console.log(' ---- ' + jsonPath + ' (writing)')
			fs.mkdirSync(jsonDir, { recursive: true })
			fs.writeFileSync(jsonPath, JSON.stringify(issue))
		} catch (e) {
			console.log({e})
		}

		return issue
	}


	async getIssue(dataTarget: DataTarget, projectId, issueInternalId): Promise<EventSchema>
	{
        const paths = new Paths()
		const target_type = 'Issue'
		const target_iid = issueInternalId
    	
		const actualPath = `${projectId}/${target_type}/${target_iid}/Issue-${target_iid}.json`

		const jsonPath = paths.generateDataTargetStoragePath(dataTarget, actualPath)

		const jsonDir = dirname(jsonPath)

		if (fs.existsSync(jsonPath)) {
			return JSON.parse(fs.readFileSync(jsonPath))
		}

		return this.rebuildIssue(dataTarget, projectId, issueInternalId)
	}

    async getFromDataTarget(dataTarget: DataTarget): Promise<EventSchema[]>
    {
        const api = new Gitlab(this.getApiOptions(dataTarget))
        const paths = new Paths()

        // const lastEventPath = paths.generatePath(dataTarget, '/_last_event.json')

        // const maxPages = fs.existsSync(lastEventPath)
        //     ? 10
        //     : 200

        const maxPages = 100

        const newEvents: EventSchema[] = []
        const updatedEntities = {}

        let done = false

        let events = [];

        try {
            // This gets issues for a project with the most recently updated issues first
            //const issues = await api.Issues.all({projectId: 66873174, orderBy: 'updated_at', updatedAfter: '2025-04-28T02:58:00Z'})

            //issues.forEach(issue => console.log(JSON.stringify(issue)))

            // This gets notes for specific issues, including when assignment changes
            //const issueStateEvents = await api.IssueNotes.all(66873174, 1)
            //issueStateEvents.forEach(event => console.log(JSON.stringify({event})))
        } catch (error) {
            console.log(error)
        }


        try {
            // We could use some of these events to pick up when we should start paying attention to
            // new issues / merge requests?
            events = await api.Events.all({ maxPages, sort: 'desc' })
        } catch (error) {
            console.log(error)

            return newEvents
        }

        events.forEach(event => {
            if (done) {
                console.log(' ---- ' + event.id)
                return
            }

			const action_name = event.action_name
			const project_id = event.project_id
            const target_type = event.note?.noteable_type ?? event.target_type ?? event.push_data?.ref_type
            const target_iid = event.note?.noteable_iid ?? event.target_iid ?? event.push_data?.ref
            
            const actualPath = (() => {
                // note.noteable_type = MergeRequest
                // note.noteable_id =
                // noteable_iid
                // 2025-04-20T23:06:06.758Z
                const dateSegmentPieces = event.created_at.split('T')[0].split('-')
                const dateSegmentSlashes = dateSegmentPieces.join('/')
                const dateSegment = event.created_at.replace(/[:\-.Z]/g, "")
                switch(true) {
                    case event.target_type !== null:
                        //const target_type = event.note?.noteable_type ?? event.target_type
                        //const target_iid = event.note?.noteable_iid ?? event.target_iid
                        return `${event.project_id}/${target_type}/${target_iid}/${dateSegment}-${event.id}.json`
                    case event.push_data !== null:
                        return `${event.project_id}/${target_type}/${target_iid}/${dateSegment}-${event.id}.json`
                    default:
                        throw new Error("Could not determine event type: " + JSON.stringify(event))
                }
            })()

            const eventPath = paths.generateDataTargetStoragePath(dataTarget, actualPath)

            const eventDir = dirname(eventPath)

            if (fs.existsSync(eventPath)) {
                console.log(' ---- ' + eventPath + ' (already there)')
                //done = true
                //return
            }

            try {
                console.log(' ---- ' + eventPath + ' (adding)')
                fs.mkdirSync(eventDir, { recursive: true })
                fs.writeFileSync(eventPath, JSON.stringify(event))

            } catch (e) {
                console.log({e})
            }

			const key = generateDataTargetKey(
				dataTarget,
				`${project_id}-${target_type}-${target_iid}`
			);

            newEvents.unshift({
				key,
				project_id,
				action_name,
				target_type,
				target_iid,
				event,
				dataTarget,
			})

			if (!updatedEntities[key]) {
				updatedEntities[key] = {
					key,
					project_id,
					target_type,
					target_iid,
					dataTarget,
				}
			}
        })

        return { newEvents, updatedEntities }
    }

    async rebuild(dataTarget: DataTarget): Promise<void> {
        const { newEvents, updatedEntities } = await this.getFromDataTarget(dataTarget)

        console.log({numberNewEvents: newEvents.length})

        Object.values(updatedEntities).forEach(event => {
			this.eventEmitter.emit(
				'entity.refresh',
				event,
			)
		})

        newEvents.forEach(async event => {
            this.eventEmitter.emit(
                'event',
				event,
            )
        })


        // then rebuild from cache...
        // throw new Error("Method not implemented.");
    }

    async rebuildFromCache(dataTarget: DataTarget): Promise<void> {
        // actually materialize things
        throw new Error("Method not implemented.");
    }
}
