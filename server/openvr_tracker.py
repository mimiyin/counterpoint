import math

import openvr


# Read tracker poses from a running SteamVR through OpenVR.
# A simplified version of the triad_openvr library.
# TODO: might need to switch to OpenXR library in the future, as OpenVR is deprecated.
# reference: https://github.com/TriadSemi/triad_openvr/blob/master/triad_openvr.py
class OpenVRTracker:
    """Reads tracker poses from a running SteamVR through OpenVR."""

    def __init__(self):
        self.vr = openvr.init(openvr.VRApplication_Other)
        self.poses = (openvr.TrackedDevicePose_t * openvr.k_unMaxTrackedDeviceCount)()

    def update_poses(self):
        self.vr.getDeviceToAbsoluteTrackingPose(openvr.TrackingUniverseStanding, 0, self.poses)

    # exact copy of the function from triad_openvr.py
    @staticmethod
    def convert_to_quaternion(pose_mat):
        r_w = math.sqrt(abs(1+pose_mat[0][0]+pose_mat[1][1]+pose_mat[2][2]))/2
        r_x = (pose_mat[2][1]-pose_mat[1][2])/(4*r_w)
        r_y = (pose_mat[0][2]-pose_mat[2][0])/(4*r_w)
        r_z = (pose_mat[1][0]-pose_mat[0][1])/(4*r_w)

        x = pose_mat[0][3]
        y = pose_mat[1][3]
        z = pose_mat[2][3]
        return [x,y,z,r_w,r_x,r_y,r_z]

    # exact copy of the function from triad_openvr.py
    @staticmethod
    def convert_to_euler(pose_mat):
        yaw = 180 / math.pi * math.atan2(pose_mat[1][0], pose_mat[0][0])
        pitch = 180 / math.pi * math.atan2(pose_mat[2][0], pose_mat[0][0])
        roll = 180 / math.pi * math.atan2(pose_mat[2][1], pose_mat[2][2])
        x = pose_mat[0][3]
        y = pose_mat[1][3]
        z = pose_mat[2][3]
        return [x,y,z,yaw,pitch,roll]

    def read(self):
        self.update_poses()

        trackers = []
        for i, pose in enumerate(self.poses):
            if self.vr.getTrackedDeviceClass(i) != openvr.TrackedDeviceClass_GenericTracker:
                continue
            if not pose.bDeviceIsConnected or not pose.bPoseIsValid:
                continue

            pose_mat = pose.mDeviceToAbsoluteTracking.m

            # compare with the output of the TD plugin
            print("tracker pose: ", pose_mat)
            # TODO: switch to a more structured format, after checking if the pose is consistent to TD plugin output.
            trackers.append({
                'id': self.vr.getStringTrackedDeviceProperty(i, openvr.Prop_SerialNumber_String),
                'position in quaternion': self.convert_to_quaternion(pose_mat),
                'position in euler': self.convert_to_euler(pose_mat),
            })
        return trackers

    def close(self):
        openvr.shutdown()
