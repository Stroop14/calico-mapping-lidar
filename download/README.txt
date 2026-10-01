Calico / Silver King Mine - terrestrial LiDAR point clouds (download package)
==========================================================================

What this is
  Handheld/terrestrial LiDAR scans of the Silver King Mine tunnel at Calico Ghost Town,
  California (portal approx. 34.95117 N, 116.86307 W), collected on 24 March 2019 during the
  CSUSB geology field camp led by Dr. Erik Melchiorre. Scans collected and processed by
  Michael Murrey with the class.

Files
  calico_scan_a.laz   14,373,530 points   49.6 MB (49,629,151 bytes)   Scan A
  calico_scan_b.laz   14,295,579 points   50.7 MB (50,669,144 bytes)   Scan B
  (28,669,109 points in total. Lossless LAZ compression of the original LAS files,
   which were ~489 MB and ~486 MB. Each file is under GitHub's 100 MB limit.)

Format / coordinates
  LAS 1.2, point format 3, compressed to LAZ (LASzip). Scale 0.0001.
  Coordinates are in a LOCAL SLAM frame (no CRS / not georeferenced); units are metres.
  The two scans are SEPARATE, un-registered files, each in its own local frame, so they
  will not line up when loaded together without applying a transform. (The website's
  walkthrough uses a registered, merged, 2 cm-voxel version: ~5.36 M points.)
  Bounds (m):
    Scan A  X -91.29..12.46   Y 0.33..53.90    Z -10.61..-4.22
    Scan B  X -123.72..-66.16 Y 26.50..60.98   Z -16.63..2.24
  No RGB; intensity is not populated.

How to open
  CloudCompare : File > Open (LAZ is supported natively). Free: cloudcompare.org
  QGIS 3.18+   : Layer > Add Layer > Add Point Cloud Layer (choose "Local" / no CRS)
  PDAL         : pdal info calico_scan_a.laz ; pdal translate calico_scan_a.laz out.las
  Python       : pip install "laspy[lazrs]" ; laspy.read("calico_scan_a.laz")
  LAStools/laszip : laszip -i calico_scan_a.laz -o calico_scan_a.las

Credit
  CSUSB geology field camp, Dr. Erik Melchiorre. Data collected and processed by Michael Murrey.
  Website: https://stroop14.github.io/calico-mapping-lidar/
