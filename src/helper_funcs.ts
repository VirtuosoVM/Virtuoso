import * as config from "../config.json";

import type * as vmr_type from "vmrun";

import * as fs from "fs";
import * as path from "path";

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
 * @returns {object} the VMRun-friendly options object
 * @throws {Error} if the vmx path is not specified in the config
 * @throws {Error} if the vmx path does not exist on the filesystem
*/
export const edit_vmrun_opts = (input_opts: { [key: string]: any }, vmrun_opts: { [key: string]: any }) => {

    // optional fields for vm_password and default credentials
    if (input_opts["vm_password"]) {
        vmrun_opts["vmPassword"] = config.vmware.default_options.vm_password;
    }

    if (input_opts["credentials"]["default"]) {
        if (input_opts.credentials.default["username"]) {
            vmrun_opts["guestUsername"] = input_opts.credentials.default.username;
        }

        if (input_opts.credentials.default["password"]) {
            vmrun_opts["guestPassword"] = input_opts.credentials.default.password;
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
 * Wait for a file to exist on the guest filesystem
 * 
 * @param vmrun - the VMRun module to use
 * @param {string} vmx_path - the path to the VMX file to use
 * @param {string} file_path - the path to the file to wait for
 * @param {number} timeout_ms - the maximum time to wait for the file to exist
 * @param {number} interval_ms - the interval to check for the file
 * @returns {Promise<void>} - resolves when the file exists, rejects if the timeout is reached
 * @throws {Error} if the file does not exist after the timeout
*/
export const wait_for_file_to_exist_in_guest = (vmrun: vmr_type, vmx_path: string, file_path: string, timeout_ms: number, interval_ms: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const start_time = Date.now();

        const interval = setInterval(() => {
            if (vmrun.fileExistsInGuest(vmx_path, file_path)) {
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


/**
 * Resolves an ID or mention of a user to a user ID
 * 
 * @param user_reference An ID or mention of a user
 * @returns The user ID
 */
export const resolve_user = (user_reference: string) => {
    if (user_reference.startsWith("<@") && user_reference.endsWith(">")) {
        user_reference = user_reference.slice(2, -1);

        if (user_reference.startsWith("!")) {
            user_reference = user_reference.slice(1);
        }

        return user_reference;
    }

    return user_reference;
};


/**
 * runProgramInGuest wrapper that returns stdout (using temp file copy)
 * @param passed_vmrun The vmrun object to use
 * @param vm The VM object from the config
 * @param vmx_path The path to the VMX file
 * @param program The program to execute
 * @param program_args The arguments to pass to the program
 * @param opts The options to pass to vmrun {noWait = false, interactive = false, activeWindow = false}
 * @param skip If true, ignore the wrapper and just call runProgramInGuest
 * @returns {Promise<{ local: { stdout: string, stderr: string }, guest_out: string }>} - resolves with the stdout and stderr of the program
 */
export const execute_stdout_wrapper = async (passed_vmrun: vmr_type, vm: object, vmx_path: string, program: string, program_args: string[], opts: { noWait?: boolean, interactive?: boolean, activeWindow?: boolean }, skip?: boolean): Promise<{ local: { stdout: string, stderr: string }, guest_out: string }> => {
    if (skip) {
        return await passed_vmrun.runProgramInGuest(vmx_path, program, program_args, opts);
    }
    
    // create temp file on guest to recieve stdout
    let out_temp_file = await passed_vmrun.createTempfileInGuest(vmx_path);

    // strip temp file of newlines at the start and end
    // (sometimes added by vmrun)
    out_temp_file = out_temp_file.replace(/^\s+|\s+$/g, "");
    console.log(`Created temp file ${out_temp_file} on guest`);

    // create temp file on guest to store script
    let script_temp_file = await passed_vmrun.createTempfileInGuest(vmx_path);

    // strip temp file of newlines at the start and end
    // (sometimes added by vmrun)
    script_temp_file = script_temp_file.replace(/^\s+|\s+$/g, "");
    console.log(`Created temp file ${script_temp_file} on guest`);

    // rename to end in .bat if windows, or .sh if linux
    const is_windows = vm["is_windows"] || false;
    const script_temp_file_ext = is_windows ? ".bat" : ".sh";
    const script_temp_file_ext_renamed = script_temp_file + script_temp_file_ext;
    await passed_vmrun.renameFileInGuest(vmx_path, script_temp_file, script_temp_file_ext_renamed);
    console.log(`Renamed temp file ${script_temp_file} to ${script_temp_file_ext_renamed} on guest`);

    // write script to temp file on guest to run command and pipe output
    // it wont let me just append the pipe as vmrun tries to escape it in a broken way
    // so we have to write a local script and copy it over

    // add the pipe after each line
    const pipe = is_windows ? ">" : "|";
    const escaped_out_temp_file = (out_temp_file + "").replace(/[\/\\]*$/, ""); // excerpt from node-vmrun
    const joined_prog = program + " " + program_args.join(" ");
    console.log(`Joined program: ${joined_prog}`);
    const script = joined_prog.split("\n").map(line => line + " " + pipe + " " + escaped_out_temp_file).join("\n");

    // write to local path then copy to guest
    const script_temp_file_basename = path.basename(script_temp_file_ext_renamed);
    const script_local_path = path.resolve(path.join(config.vmware["tmp_dir"] || "./vm_tmp", script_temp_file_basename));

    try {
        fs.writeFileSync(script_local_path, script)
    } catch (err) {
        // delete temp files on guest then rethrow
        await passed_vmrun.deleteFileInGuest(vmx_path, out_temp_file);
        await passed_vmrun.deleteFileInGuest(vmx_path, script_temp_file_ext_renamed);

        throw err;
    }

    await passed_vmrun.copyFileFromHostToGuest(vmx_path, script_local_path, script_temp_file_ext_renamed);

    // delete local script
    fs.unlinkSync(script_local_path);


    const options = {
        noWait: opts.noWait || false,
        interactive: opts.interactive || false,
        activeWindow: opts.activeWindow || false
    };

    const result = { local: { stdout: "", stderr: "" }, guest_out: "" };

    try {
        const exec_res = await passed_vmrun.runProgramInGuest(vmx_path, script_temp_file_ext_renamed, [], options);
        result.local.stderr = exec_res.stderr;
        result.local.stdout = exec_res.stdout;
    } catch (err) {
        // delete temp files on guest then rethrow
        await passed_vmrun.deleteFileInGuest(vmx_path, out_temp_file);
        await passed_vmrun.deleteFileInGuest(vmx_path, script_temp_file_ext_renamed);

        throw err;
    }

    // copy temp file to local
    const temp_file_basename = path.basename(out_temp_file);
    const host_path = path.resolve(path.join(config.vmware["tmp_dir"] || "./vm_tmp/", temp_file_basename));
    await passed_vmrun.copyFileFromGuestToHost(vmx_path, out_temp_file, host_path);

    try {
        await wait_for_file_to_exist(host_path, 5000, 10);
    } catch (err) {
        // delete temp files on guest then throw timeout error
        await passed_vmrun.deleteFileInGuest(vmx_path, out_temp_file);
        await passed_vmrun.deleteFileInGuest(vmx_path, script_temp_file_ext_renamed);

        throw new Error(`Timeout waiting for file to exist: ${host_path}`);
    }

    // delete temp files on guest
    await passed_vmrun.deleteFileInGuest(vmx_path, out_temp_file);
    await passed_vmrun.deleteFileInGuest(vmx_path, script_temp_file_ext_renamed);

    // read temp file
    const temp_file_contents = fs.readFileSync(host_path, "utf-8");
    result.guest_out = temp_file_contents;
    fs.unlinkSync(host_path);

    console.log(`Deleted temp file ${host_path} on host`);

    return result;
};