const vsphere = require('./vsphere');

const hostname = 'TODO';
const username = 'TODO';
const password = 'TODO';

/**
 * A mapping of managed object types to the properties we want to collection from them.
 *
 * Key names should exactly match the managed object name, including case.
 */
const objectProps = {
    VirtualMachine: [
        'name',
        'availableField',
        'value',
        'config.instanceUuid',
        'config.uuid',
        'guest.toolsStatus',
        'guest.toolsVersionStatus',
        'guest.toolsVersionStatus2',
        'guest.toolsRunningStatus',
        'guest.guestId',
        'guest.guestFamily',
        'guest.guestFullName',
        'guest.guestState',
        'guest.guestOperationsReady',
        'guest.interactiveGuestOperationsReady',
    ],
};

/**
 * Creates a series of property specs based on the contents of the objectProps
 * definitions. Each managed object type has its properties contained in the spec.
 *
 * @param {*} service VIM service.
 */
const propertySpecs = service => {
    return Object.keys(objectProps).map(type => {
        return service.vim.PropertySpec({
            type,
            pathSet: objectProps[type],
        });
    });
};

/**
 * Helper method to create a selection spec as part of a traversal.
 *
 * @param {*} service
 * @param {*} names
 */
const selectionSpec = (service, names) => {
    return names.map(name => service.vim.SelectionSpec({ name }));
};

/**
 * Helper method to create a traversal spec.
 *
 * @param {*} service
 * @param {*} name
 * @param {*} type
 * @param {*} path
 * @param {*} selectSet
 */
const traversalSpec = (service, name, type, path, selectSet) => {
    return service.vim.TraversalSpec({
        name,
        type,
        path,
        skip: false,
        selectSet,
    });
};

/**
 * Creates a full, recursive traversal spec.
 *
 * @param {*} service
 */
const fullTraversalSpec = service => {
    return [
        // ResourcePool -> ResourcePool
        traversalSpec(service, 'rpToRp', 'ResourcePool', 'resourcePool', selectionSpec(service, ['rpToRp', 'rpToVm'])),

        // ResourcePool -> VM
        traversalSpec(service, 'rpToVm', 'ResourcePool', 'vm', []),

        // ComputeResource -> ResourcePool
        traversalSpec(service, 'crToRp', 'ComputeResource', 'resourcePool', selectionSpec(service, ['rpToRp', 'rpToVm'])),

        // ComputeResource -> HostSystem
        traversalSpec(service, 'crToH', 'ComputeResource', 'host', []),

        // Datacenter -> HostFolder Folder
        traversalSpec(service, 'dcToHf', 'Datacenter', 'hostFolder', selectionSpec(service, ['visitFolders'])),

        // Datacenter -> VirtualMachine Folder
        traversalSpec(service, 'dcToVmf', 'Datacenter', 'vmFolder', selectionSpec(service, ['visitFolders'])),

        // HostSystem -> VirtualMachine
        traversalSpec(service, 'HToVm', 'HostSystem', 'vm', selectionSpec(service, ['visitFolders'])),

        // Datacenter -> Datastore Folder
        traversalSpec(service, 'dcToDs', 'Datacenter', 'datastoreFolder', selectionSpec(service, ['visitFolders'])),

        // vApp to ResourcePool
        traversalSpec(service, 'vAppToRp', 'VirtualApp', 'resourcePool', selectionSpec(service, ['rpToRp', 'vAppToRp'])),

        /*
         * Copyright 2009 Altor Networks, contribution by Elsa Bignoli
         * @author Elsa Bignoli (elsa@altornetworks.com)
         */
        // Datacenter -> Network Folder
        traversalSpec(service, 'dcToNetf', 'Datacenter', 'networkFolder', selectionSpec(service, ['visitFolders'])),

        // Folder -> Folder
        traversalSpec(
            service,
            'visitFolders',
            'Folder',
            'childEntity',
            selectionSpec(service, [
                'visitFolders',
                'dcToHf',
                'dcToVmf',
                'dcToDs',
                'dcToNetf',
                'crToH',
                'crToRp',
                'HToVm',
                'rpToVm',
            ]),
        ),
    ];
};

/**
 * Parses the results of the retrieve properties call from a list of
 * returned properties into the original, nested object structure.
 *
 * @param {*} result
 */
const parseResult = result => {
    const mapping = {};

    result.objects.forEach(it => {
        const props = {};

        const key = it.obj.value;

        it.propSet.forEach(it => {
            const paths = it.name.split('.');
            let cursor = props;

            while (paths.length > 0) {
                const path = paths.shift();

                if (!paths.length) {
                    cursor[path] = it.val;
                } else {
                    if (!(path in cursor)) {
                        cursor[path] = {};
                    }
                    cursor = cursor[path];
                }
            }
        });

        mapping[key] = props;
    });

    return mapping;
};

const start = async () => {
    const service = await vsphere.vimService(hostname).then(async service => {
        await service.vimPort.login(service.serviceContent.sessionManager, username, password);
        return service;
    });

    try {
        var propertyCollector = service.serviceContent.propertyCollector;
        var rootFolder = service.serviceContent.rootFolder;

        const filterSpecs = [
            service.vim.PropertyFilterSpec({
                objectSet: service.vim.ObjectSpec({
                    obj: rootFolder,
                    selectSet: fullTraversalSpec(service),
                }),
                propSet: propertySpecs(service),
            }),
        ];

        return await service.vimPort
            .retrievePropertiesEx(propertyCollector, filterSpecs, service.vim.RetrieveOptions())
            .then(result => {
                console.log(JSON.stringify(parseResult(result), null, 2));
            });
    } finally {
        service.vimPort.logout(service.serviceContent.sessionManager);
    }
};

start().catch(err => {
    console.error(err);
});
