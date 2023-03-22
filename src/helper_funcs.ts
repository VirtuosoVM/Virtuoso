import * as config from "../config.json";

import type * as vmr_type from "vmrun";

import * as fs from "fs";

let VMRun: typeof vmr_type;

// TODO: replace generic error with a custom error type


/**
 * Update the helper module's internal VMRun state (to prevent needing to pass VMRun in each function call)
 *
 * @param {typeof VMRun} vmrun - the VMRun module with the updated options state
 */
export const update_vmrun_state = (vmrun: typeof vmr_type) => {
    VMRun = vmrun;
};

/**
 * Parse config options into a VMRun-friendly options object
 * 
 * @param {object} input_opts - the options specified in the config
 * @param {object} vmrun_opts - the options object to edit
 * @returns {void}
 * @throws {Error} if the vmx path is not specified in the config
 * @throws {Error} if the vmx path does not exist on the filesystem
*/
export const edit_vmrun_opts = (input_opts: { [key: string]: any }, vmrun_opts: { [key: string]: any }) => {
    // optional fields for vm_password and guest_creds
    if (input_opts["vm_password"]) {
        vmrun_opts["vmPassword"] = config.vmware.default_options.vm_password;
    }

    if (input_opts["guest_creds"]) {
        if (input_opts.guest_creds["username"]) {
            vmrun_opts["guestUsername"] = input_opts.guest_creds.username;
        }

        if (input_opts.guest_creds["password"]) {
            vmrun_opts["guestPassword"] = input_opts.guest_creds.password;
        }
    }
};

/**
 * Wait for a file to exist on the filesystem
 * 
 * @param {string} file_path - the path to the file to wait for
 * @param {number} timeout_ms - the maximum time to wait for the file to exist
 * @param {number} interval_ms - the interval to check for the file
 * @returns {Promise<void>} - resolves when the file exists, rejects if the timeout is reached
 * @throws {Error} if the file does not exist after the timeout
*/
export const wait_for_file_to_exist = (file_path: string, timeout_ms: number, interval_ms: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const start_time = Date.now();

        const interval = setInterval(() => {
            if (fs.existsSync(file_path)) {
                clearInterval(interval);
                resolve();
            } else if (Date.now() - start_time > timeout_ms) {
                clearInterval(interval);
                reject();
            }
        }, interval_ms);
    });
};

/**
 * Get the list of VM IDs that are currently powered on
 * 
 * @returns {Promise<string[]>} - resolves with the list of VM IDs that are currently powered on
 * @throws {Error} if the vm id does not exist in the config
 * @throws {Error} if the vmx path is not specified in the config
 * @throws {Error} if the vmx path does not exist on the filesystem
 */
export const list_running_vm_ids = async (): Promise<string[]> => {
    const vm = config.vmware.vm_list;
    const id_list = [];
    const running_vms = await VMRun.list();

    // TODO: should this be the other way? i.e. iterate over running_vms and check if they are in the config
    for (const vm_id in vm) {
        const vmx_path = vm[vm_id].vmx;

        if (!vmx_path) {
            throw new Error(`VMX path not specified for VM ${vm_id}`);
        }

        // validate the vmx path exists on the filesystem
        if (!fs.existsSync(vmx_path)) {
            throw new Error(`VMX file does not exist: ${vmx_path} for VM ${vm_id}`);
        }

        // for every vm that is powered on, match the vmx path to the vm id
        for (const running_vm of running_vms) {
            if (running_vm === vmx_path) {
                id_list.push(vm_id);
            }
        }
    }

    return id_list;
};

/** Query the power state of a VM by the ID
 * 
 * @param {string} vm_id - the ID of the VM to query
 * @returns {Promise<boolean>} - resolves with the power state of the VM
 * @throws {Error} if the id does not exist in the config
 * @throws {Error} if the vmx path is not specified in the config
 * @throws {Error} if the vmx path does not exist on the filesystem
 */
export const query_vm_id_power_state = async (vm_id: string): Promise<boolean> => {
    // TODO: DRY similar code in other commands
    const vm = config.vmware.vm_list[vm_id];

    if (!vm) {
        throw new Error(`Invalid VM ID: ${vm_id}`);
    }

    const vmx_path = vm.vmx;

    // validate the vmx path exists on the filesystem
    if (!fs.existsSync(vmx_path)) {
        throw new Error(`VMX file does not exist: ${vmx_path} for VM ${vm_id}`);
    }

    // set the vmrun options if overridden in the config
    let VMRun_mod = VMRun;

    if (vm["options_override"]) {
        const overriden_vmrun_opts = {};
        edit_vmrun_opts(vm.options_override, overriden_vmrun_opts);
        VMRun_mod = VMRun_mod.withModifiedOptions(overriden_vmrun_opts);
    }

    // repeated code so we don't iterate over the entire list of vms
    const running_vms = await VMRun_mod.list();

    // for every vm that is powered on, match the vmx path to the vm id
    for (const running_vm of running_vms) {
        if (running_vm === vmx_path) {
            return true;
        }
    }

    return false;
}

/**
 * Query the power state of a VM by the VMX path (doesn't check if the VMX path exists)
 * 
 * @param {string} vmx_path - the path to the VMX file of the VM to query
 * @returns {Promise<boolean>} - resolves with the power state of the VM
 */
export const query_vm_path_power_state = async (vmx_path: string): Promise<boolean> => {
    const running_vms = await VMRun.list();
    return running_vms.includes(vmx_path);
};
