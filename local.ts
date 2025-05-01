export class Paths {
    private root: string;

    constructor(root: string = '.') {
        this.root = root
    }

    generatePath(path: string = ''): string {
        return `${this.root}/${path}`
    }

    generateDataTargetStoragePath(dataTarget: DataTarget, path: string = ''): string {
        const hostname = dataTarget.hostname ?? 'default'

        return `./data/${dataTarget.type}/${hostname}/${path}`
    }

    generateDataTargetStorageEntityPath(dataTarget: DataTarget, projectId: string, targetType: string, targetInternalId: int, path: string = ''): string {
		return this.generateDataTargetStoragePath(
			dataTarget, 
			`${projectId}/${targetType}/${targetInternalId}/${path}`
		)
	}

    generateDataTargetStorageEntity(dataTarget: DataTarget, projectId: string, targetType: string, targetInternalId: int): string {
		return this.generateDataTargetStorageEntityPath(
			dataTarget, 
			projectId,
			targetType,
			targetInternalId,
			`${targetType}-${targetInternalId}.json`
		)
    }

    generateDataTargetStorageEntityEventPath(dataTarget: DataTarget, projectId: string, targetType: string, targetInternalId: int, path: string = ''): string {
		return this.generateDataTargetStorageEntityPath(
			dataTarget, 
			projectId,
			targetType,
			targetInternalId,
			`_events/${path}`
		)
    }

    generateDataTargetStorageEntityEvent(dataTarget: DataTarget, projectId: string, targetType: string, targetInternalId: int, event): string {
		const dateSegment = event.created_at.replace(/[:\-.Z]/g, "")
		const path = `${dateSegment}-${event.id}.json`

		return this.generateDataTargetStorageEntityEventPath(
			dataTarget, 
			projectId,
			targetType,
			targetInternalId,
			path,
		)
    }
}

export interface Credentials {
    type: string,
    hostname: string,
    path: string,
    token: string,
}

export interface CredentialsStore {
    getToken(dataTarget: DataTarget, path: string): string
    setToken(dataTarget: DataTarget, path: string, token: string): void
    export(): CredentialsCollection
}

export interface CredentialsCollection {
    [type: string]: {
        [hostname: string]: {
            [path: string]: string
        }
    }
}
export class DefaultCredentialsStore implements CredentialsStore {
    private credentialsCollection: CredentialsCollection = {}

    constructor(credentialsCollection: CredentialsCollection = {}) {
        this.credentialsCollection = credentialsCollection
    }

    getToken(dataTarget: DataTarget, path: string): string {
        const { type, hostname = 'DEFAULT' } = dataTarget

        const token = this.credentialsCollection[type]?.[hostname]?.[path]

        if (!token) {
            throw new Error("Could not find data for specific data target and path")
        }

        return token
    }

    setToken(dataTarget: DataTarget, path: string, token: string): void {
        const { type, hostname = 'DEFAULT' } = dataTarget

        this.credentialsCollection[type] ??= {}
        this.credentialsCollection[type][hostname] ??= {}
        this.credentialsCollection[type][hostname][path] = token
    }

    export(): CredentialsCollection {
        return this.credentialsCollection
    }
}

export function generateKey(dataTarget: DataTarget,  path: string = '/'): string
{
    return `${dataTarget.type}-${dataTarget.hostname ?? 'default'}-${path}`
}

export interface Entity {
    id: string,
}

export interface UrlAddressable {
    web_url: string,
}

export interface User extends Entity, UrlAddressable {
    username: string,
    name: string,
    avatar_url: string,
}

export interface Project extends Entity, UrlAddressable {
    name: string,
    path: string,
    name_with_namespace: string,
    path_with_namespace: string,
}

export interface Issue extends Entity, UrlAddressable {
}

export interface MergeRequest extends Entity, UrlAddressable {
}

export interface Discussion extends Entity, UrlAddressable {
}

export interface DataTarget {
    type: string,
    hostname?: string,
    port?: number,
}

export interface Data {
    rebuild(dataTarget: DataTarget): void,
    rebuildFromCache(dataTarget: DataTarget): void,
}

export interface DataSupports extends Data {
    supports(dataTarget: DataTarget): boolean;
}

export class MainData implements Data {
    datas: DataSupports[] = [];

    register(data: DataSupports): void {
        this.datas.push(data)
    }

    rebuildMergeRequest(dataTarget: DataTarget, projectId, mergeRequestInternalId): void {
        const data = this.datas.find(data => data.supports(dataTarget))

        if (!data) {
            throw new Error("Could not find data supporting the target")
        }

        return data.rebuildMergeRequest(dataTarget, projectId, mergeRequestInternalId)
	}

    getMergeRequest(dataTarget: DataTarget, projectId, mergeRequestInternalId): void {
        const data = this.datas.find(data => data.supports(dataTarget))

        if (!data) {
            throw new Error("Could not find data supporting the target")
        }

        return data.getMergeRequest(dataTarget, projectId, mergeRequestInternalId)
    }


    rebuildIssue(dataTarget: DataTarget, projectId, issueInternalId): void {
        const data = this.datas.find(data => data.supports(dataTarget))

        if (!data) {
            throw new Error("Could not find data supporting the target")
        }

        return data.rebuildIssue(dataTarget, projectId, issueInternalId)
	}

    getIssue(dataTarget: DataTarget, projectId, issueInternalId): void {
        const data = this.datas.find(data => data.supports(dataTarget))

        if (!data) {
            throw new Error("Could not find data supporting the target")
        }

        return data.getIssue(dataTarget, projectId, issueInternalId)
    }

    rebuild(dataTarget: DataTarget): void {
        const data = this.datas.find(data => data.supports(dataTarget))

        if (!data) {
            throw new Error("Could not find data supporting the target")
        }

        data.rebuild(dataTarget)
    }

    rebuildFromCache(dataTarget: DataTarget): void {
        const data = this.datas.find(data => data.supports(dataTarget))

        if (!data) {
            throw new Error("Could not find data supporting the target")
        }

        data.rebuildFromCache(dataTarget)
    }
}
