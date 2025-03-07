#!/usr/bin/env bash
# merge.sh - Revised version with better debugging and error handling

# ANSI color codes for logging:
RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[0;33m'
NC='\033[0;m'  # No Color

# Setup base paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$( dirname "$SCRIPT_DIR" )"
DATA_DIR="$BASE_DIR/data"
IMAGES_DIR="$DATA_DIR/images"       # Use original images directory
AUDIO_DIR="$DATA_DIR/audio"         # Use original audio directory
TEMP_DIR="$DATA_DIR/temp"
OUTPUT_DIR="$DATA_DIR/output"

# Define a blacklist of known problematic files
declare -a BLACKLIST=(
    "This 3D crosswalk in Iceland slows down traffic wi.jpg"
    "Passenger forced to sit next to a corpse for 4 hou.jpg"
)

# Print path information for debugging
echo "Script directory: $SCRIPT_DIR"
echo "Base directory: $BASE_DIR"
echo "Data directory: $DATA_DIR"
echo "Images directory: $IMAGES_DIR"
echo "Audio directory: $AUDIO_DIR"
echo "Output directory: $OUTPUT_DIR"
echo "Blacklisted files: ${#BLACKLIST[@]}"

# Clear the output directory
echo "Clearing output directory..."
rm -f "$OUTPUT_DIR"/*

# Create directories if they don't exist
mkdir -p "$TEMP_DIR" "$OUTPUT_DIR"

declare -a failed_posts   # Posts that failed processing
declare -a success_posts  # Posts that succeeded
declare -a corrupt_files  # Track corrupt files

# Maximum time (in seconds) to allow for ffmpeg operations
FFMPEG_TIMEOUT=120  # 2 minutes timeout

##############################################
# Fallback for realpath on macOS if not installed
##############################################
if ! command -v realpath >/dev/null 2>&1; then
    realpath() {
        if [[ "$1" = /* ]]; then
            echo "$1"
        else
            echo "$PWD/$1"
        fi
    }
fi

##############################################
# Function: sanitize_filename
##############################################
sanitize_filename() {
    local filename
    filename=$(basename "$1")
    filename="${filename%.*}"
    
    # Safe sanitization that preserves most of the filename
    filename=$(echo "$filename" | iconv -c -t ascii//TRANSLIT | tr -c '[:alnum:]' '_' | tr -s '_')
    
    echo "$filename"
}

##############################################
# Function: is_image_valid
# Checks if an image file is valid using ffprobe
##############################################
is_image_valid() {
    local img_file="$1"
    
    # Use ffprobe to check if the image is valid
    ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$img_file" > /dev/null 2>&1
    
    # Return the result (0 = valid, non-zero = invalid)
    return $?
}

##############################################
# Function: is_blacklisted
# Checks if a file is in the blacklist
##############################################
is_blacklisted() {
    local filename=$(basename "$1")
    
    for blacklisted in "${BLACKLIST[@]}"; do
        if [[ "$filename" == "$blacklisted" ]]; then
            return 0  # True, file is blacklisted
        fi
    done
    
    return 1  # False, file is not blacklisted
}

##############################################
# Function: extract_debug_frames
# Extracts frames from videos and images for debugging
##############################################
extract_debug_frames() {
    local source_file="$1"
    local output_prefix="$2"
    local frame_type="$3"  # "blur" or "final" or "overlay"
    
    # Create debug directory if it doesn't exist
    local debug_dir="$DATA_DIR/debug"
    mkdir -p "$debug_dir"
    
    # Extract a frame from the source file
    ffmpeg -hide_banner -loglevel warning \
        -i "$source_file" \
        -vframes 1 \
        -f image2 \
        "$debug_dir/${output_prefix}_${frame_type}.png" >/dev/null 2>&1
        
    echo "Debug frame saved to $debug_dir/${output_prefix}_${frame_type}.png"
    
    # Print color analysis of the frame edges to detect letterboxing
    if [[ "$frame_type" == "final" ]]; then
        echo "Analyzing frame for letterboxing..."
        # Extract a 10x10 pixel sample from the top-left corner
        ffmpeg -hide_banner -loglevel warning \
            -i "$debug_dir/${output_prefix}_${frame_type}.png" \
            -vf "crop=10:10:0:0" \
            -vframes 1 \
            -f image2 \
            "$debug_dir/${output_prefix}_topleft_sample.png" >/dev/null 2>&1
            
        # Check if the sample is black (would indicate letterboxing)
        avg_color=$(convert "$debug_dir/${output_prefix}_topleft_sample.png" -format "%[fx:mean]" info:)
        if (( $(echo "$avg_color < 0.1" | bc -l) )); then
            echo -e "${RED}DETECTED BLACK LETTERBOXING: Top-left corner is black (avg brightness: $avg_color)${NC}"
        else
            echo -e "${GRN}NO LETTERBOXING DETECTED: Top-left corner is not black (avg brightness: $avg_color)${NC}"
        fi
    fi
}

##############################################
# Function: check_blur_effect
# Determines if the blur effect was actually applied
##############################################
check_blur_effect() {
    local blur_file="$1"
    local final_file="$2"
    local prefix="$3"
    
    # Extract frames for visual inspection
    extract_debug_frames "$blur_file" "${prefix}" "blur"
    extract_debug_frames "$final_file" "${prefix}" "final"
    
    echo "Debug frames extracted for analysis. Check the debug directory."
    
    # Compare blur level between blurred background and final video
    local debug_dir="$DATA_DIR/debug"
    echo "Analyzing blur level in the output..."
    
    # Extract a variance measurement (higher = more variance = less blur)
    blur_variance=$(convert "$debug_dir/${prefix}_blur.png" -format "%[fx:standard_deviation]" info:)
    final_variance=$(convert "$debug_dir/${prefix}_final.png" -format "%[fx:standard_deviation]" info:)
    
    echo "Blur file variance: $blur_variance"
    echo "Final file variance: $final_variance"
    
    # Higher variance in the final vs blur indicates the sharp image is overlaid on blur
    if (( $(echo "$final_variance > $blur_variance" | bc -l) )); then
        echo -e "${GRN}BLUR EFFECT DETECTED: The final video appears to have the proper blur+overlay effect${NC}"
    else
        echo -e "${RED}NO BLUR EFFECT DETECTED: The final video doesn't seem to have the blur effect applied correctly${NC}"
    fi
}

##############################################
# Function: process_single_image
# Process a single image with audio - optimized for single images
# Uses a direct approach that works well for single images
##############################################
process_single_image() {
    local image_path="$1"
    local audio_path="$2"
    local output_path="$3"
    
    local image_name=$(basename "$image_path")
    local image_display="${image_name:0:50}" # Truncate for display
    local debug_prefix=$(echo "$image_name" | tr -c '[:alnum:]' '_' | cut -c1-30)
    
    echo "Merging single image '$image_display' with audio => '$output_path'..."
    
    # Create debug directory if it doesn't exist
    mkdir -p "$DATA_DIR/debug"
    
    # Get original image dimensions to verify aspect ratio
    local orig_dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$image_path")
    local orig_width=$(echo $orig_dimensions | cut -d'x' -f1)
    local orig_height=$(echo $orig_dimensions | cut -d'x' -f2)
    local orig_aspect=$(echo "scale=6; $orig_width / $orig_height" | bc)
    
    echo "Original image dimensions: ${orig_width}x${orig_height}, aspect ratio: $orig_aspect"
    
    # Target dimensions and aspect ratio
    local target_width=720
    local target_height=1280
    
    # Create a temporary scaled version of the image that fills the entire frame
    # This will be used for the blur background
    local temp_scaled="$TEMP_DIR/${debug_prefix}_scaled_temp.png"
    ffmpeg -hide_banner -loglevel warning -nostdin \
        -i "$image_path" \
        -vf "scale=$target_width:$target_height:force_original_aspect_ratio=increase,crop=$target_width:$target_height" \
        "$temp_scaled" 2>/dev/null
    
    # Create a blurred version of the scaled image
    local temp_blurred="$TEMP_DIR/${debug_prefix}_blurred_temp.png"
    ffmpeg -hide_banner -loglevel warning -nostdin \
        -i "$temp_scaled" \
        -vf "boxblur=20:5" \
        "$temp_blurred" 2>/dev/null
    
    # Create the final video with the blurred background and original image overlay
    ffmpeg -hide_banner -loglevel warning -nostdin \
        -loop 1 -i "$temp_blurred" \
        -loop 1 -i "$image_path" \
        -i "$audio_path" \
        -filter_complex "[1:v]scale=$target_width:$target_height:force_original_aspect_ratio=decrease,pad=$target_width:$target_height:(ow-iw)/2:(oh-ih)/2:color=black@0[original];[0:v][original]overlay=(W-w)/2:(H-h)/2:format=auto,format=yuv420p[v]" \
        -map "[v]" -map 2:a \
        -c:v libx264 -preset fast -crf 23 \
        -c:a aac -b:a 128k \
        -pix_fmt yuv420p \
        -shortest \
        -movflags +faststart \
        "$output_path" 2>&1 | tee "$DATA_DIR/debug/${debug_prefix}_ffmpeg.log"
    
    # Save debug frames
    cp "$temp_scaled" "$DATA_DIR/debug/${debug_prefix}_filled.png" 2>/dev/null
    cp "$temp_blurred" "$DATA_DIR/debug/${debug_prefix}_blurred.png" 2>/dev/null
    
    # Check if ffmpeg was successful
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        # Extract a frame for verification
        ffmpeg -hide_banner -loglevel warning -nostdin \
            -i "$output_path" \
            -frames:v 1 \
            "$DATA_DIR/debug/${debug_prefix}_final.png" >/dev/null 2>&1
        
        # Get the dimensions of the output file
        local out_dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$output_path")
        echo "Output video dimensions: ${out_dimensions}"
            
        # Success
        echo -e "${GRN}Merge succeeded for '$image_display'.${NC}"
        echo "Video successfully created: $(basename "$output_path")"
        return 0
    else
        echo -e "${RED}Merge FAILED for '$image_display'.${NC}"
        return 1
    fi
}

##############################################
# Function: process_single_image_complex
# Process a single image with audio using the more complex
# method that works well for slideshows
##############################################
process_single_image_complex() {
    local image_path="$1"
    local audio_path="$2"
    local output_path="$3"
    
    local image_name=$(basename "$image_path")
    local image_display="${image_name:0:50}" # Truncate for display
    local debug_prefix=$(echo "$image_name" | tr -c '[:alnum:]' '_' | cut -c1-30)
    
    echo "Merging single image '$image_display' with audio => '$output_path'..."
    
    # Create debug directory if it doesn't exist
    mkdir -p "$DATA_DIR/debug"
    
    # Get original image dimensions to verify aspect ratio
    local orig_dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$image_path")
    local orig_width=$(echo $orig_dimensions | cut -d'x' -f1)
    local orig_height=$(echo $orig_dimensions | cut -d'x' -f2)
    local orig_aspect=$(echo "scale=6; $orig_width / $orig_height" | bc)
    
    echo "Original image dimensions: ${orig_width}x${orig_height}, aspect ratio: $orig_aspect"
    
    # Target dimensions and aspect ratio
    local target_width=720
    local target_height=1280
    local target_aspect=$(echo "scale=6; $target_width / $target_height" | bc)
    
    # Step 1: Create a version that maintains aspect ratio with letterboxing (for overlay)
    local letterboxed_image="$DATA_DIR/debug/${debug_prefix}_letterboxed.png"
    ffmpeg -hide_banner -loglevel warning -nostdin \
        -i "$image_path" \
        -vf "scale=$target_width:$target_height:force_original_aspect_ratio=decrease,pad=$target_width:$target_height:(ow-iw)/2:(oh-ih)/2:color=black" \
        "$letterboxed_image" 2>/dev/null
    
    # Step 2: Create a version that fills the entire frame by scaling and cropping (for blurring)
    # This ensures the entire 720x1280 area is filled with image content, with no black borders
    local filled_image="$DATA_DIR/debug/${debug_prefix}_filled.png"
    ffmpeg -hide_banner -loglevel warning -nostdin \
        -i "$image_path" \
        -vf "scale=$target_width:$target_height:force_original_aspect_ratio=increase,crop=$target_width:$target_height" \
        "$filled_image" 2>/dev/null
    
    # Step 3: Blur the filled version to create a blurred background that covers the entire frame
    local blurred_image="$DATA_DIR/debug/${debug_prefix}_blurred.png"
    ffmpeg -hide_banner -loglevel warning -nostdin \
        -i "$filled_image" \
        -vf "boxblur=20:5" \
        "$blurred_image" 2>/dev/null
    
    # Step 4: Extract the actual image content from the letterboxed version
    # Calculate dimensions of the actual image within the letterboxed version
    if (( $(echo "$orig_aspect > $target_aspect" | bc -l) )); then
        # Width-constrained (letterboxed on top/bottom)
        local content_width=$target_width
        local content_height=$(echo "scale=0; $target_width / $orig_aspect" | bc)
        local x_offset=0
        local y_offset=$(echo "scale=0; ($target_height - $content_height) / 2" | bc)
    else
        # Height-constrained (letterboxed on sides)
        local content_height=$target_height
        local content_width=$(echo "scale=0; $target_height * $orig_aspect" | bc)
        local x_offset=$(echo "scale=0; ($target_width - $content_width) / 2" | bc)
        local y_offset=0
    fi
    
    # Extract just the image content
    local content_only="$DATA_DIR/debug/${debug_prefix}_content.png"
    ffmpeg -hide_banner -loglevel warning -nostdin \
        -i "$letterboxed_image" \
        -vf "crop=$content_width:$content_height:$x_offset:$y_offset" \
        "$content_only" 2>/dev/null
    
    # Step 5: Create the final video with the blurred background and centered content overlay
    ffmpeg -hide_banner -loglevel warning -nostdin \
        -loop 1 -i "$blurred_image" \
        -loop 1 -i "$content_only" \
        -i "$audio_path" \
        -filter_complex "[1:v]format=rgba[content];[0:v][content]overlay=($target_width-w)/2:($target_height-h)/2:format=auto,format=yuv420p[v]" -map "[v]" -map 2:a \
        -c:v libx264 -preset fast -crf 23 \
        -c:a aac -b:a 128k \
        -pix_fmt yuv420p \
        -shortest \
        -movflags +faststart \
        "$output_path" 2>&1 | tee "$DATA_DIR/debug/${debug_prefix}_ffmpeg.log"
    
    # Check if ffmpeg was successful
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        # Extract a frame for verification
        ffmpeg -hide_banner -loglevel warning -nostdin \
            -i "$output_path" \
            -frames:v 1 \
            "$DATA_DIR/debug/${debug_prefix}_final.png" >/dev/null 2>&1
        
        # Get the dimensions of the output file
        local out_dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$output_path")
        echo "Output video dimensions: ${out_dimensions}"
            
        # Success
        echo -e "${GRN}Merge succeeded for '$image_display'.${NC}"
        echo "Video successfully created: $(basename "$output_path")"
        return 0
    else
        echo -e "${RED}Merge FAILED for '$image_display'.${NC}"
        return 1
    fi
}

##############################################
# Function: get_audio_duration
# Gets the duration of an audio file
##############################################
get_audio_duration() {
    local audio_file="$1"
    if [[ ! -f "$audio_file" ]]; then
        echo "0"
        return 1
    fi
    
    # Use ffprobe to get the duration
    local duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$audio_file")
    
    # Check if we got a valid number
    if [[ ! "$duration" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        echo "0"
        return 1
    fi
    
    echo "$duration"
    return 0
}

##############################################
# Function: process_folder_slideshow
# Creates a slideshow from images in a folder
##############################################
process_folder_slideshow() {
    local folder_path="$1"
    local folder_name=$(basename "$folder_path")
    local folder_safe_name=$(echo "$folder_name" | tr -s ' ' '_' | tr -c '[:alnum:]_' '_')
    local folder_display="${folder_name:0:50}" # Truncate for display
    local audio_file="$2"
    local output_file="$3"
    
    echo "Processing folder slideshow: $folder_name"
    
    # Create a clean temporary directory specific to this slideshow
    local temp_slideshow_dir="$TEMP_DIR/slideshow_${folder_safe_name}"
    mkdir -p "$temp_slideshow_dir"
    
    # Clear any existing files
    rm -f "$temp_slideshow_dir"/*
    
    # Get list of images from the folder - ONLY from this folder
    echo "Reading images ONLY from folder: $folder_path"
    
    # Store filtered images in a dedicated array
    local image_files=()

    # Read images directly from the folder
    for img_file in "$folder_path"/*; do
        if [[ ! -f "$img_file" ]]; then
            continue
        fi
        
        local base_img=$(basename "$img_file")
        
        # Skip any non-image files
        if [[ ! "$base_img" =~ .*\.(jpg|jpeg|png)$ ]]; then
            continue
        fi
        
        # Check if file is in blacklist
        if is_blacklisted "$base_img"; then
            echo -e "${YLW}Skipping blacklisted file: $base_img${NC}"
            continue
        fi
        
        # Strict check: file must start with folder name
        if [[ ! "$base_img" == "$folder_name"* ]]; then
            echo -e "${YLW}Skipping file not belonging to this folder: $base_img${NC}"
            continue
        fi
        
        # Add this image to our filtered array
        image_files+=("$img_file")
        echo -e "✓ Added image to slideshow: $base_img"
    done
    
    # Count valid images
    local image_count=${#image_files[@]}
    echo "Found $image_count valid images in folder '$folder_display'"
    
    # If we don't have any valid images, skip
    if [[ $image_count -eq 0 ]]; then
        echo -e "${YLW}No valid images found in folder. Skipping.${NC}"
        return 1
    fi
    
    # Calculate time per image
    local audio_duration=$(get_audio_duration "$audio_file")
    
    # Check if we got a valid duration
    if [[ -z "$audio_duration" || "$audio_duration" == "0" || "$audio_duration" == "N/A" ]]; then
        echo -e "${RED}Could not determine audio duration. Skipping.${NC}"
        return 1
    fi
    
    local time_per_image=$(bc -l <<< "$audio_duration / $image_count")
    echo "Time per image: $time_per_image seconds"
    
    # Create slideshow
    echo "Creating slideshow for folder '$folder_display' => '$output_file'..."
    
    # Process each image to create a segment
    local segment_list=()
    local i=1
    
    # Target dimensions
    local target_width=720
    local target_height=1280
    local target_aspect=$(echo "scale=6; $target_width / $target_height" | bc)
    
    # IMPORTANT: Only use our filtered image_files array
    for img in "${image_files[@]}"; do
        local base_img=$(basename "$img")
        echo "Processing image $i/$image_count: $base_img"
        
        local segment_file="$temp_slideshow_dir/segment_$i.mp4"
        segment_list+=("$segment_file")
        
        # Get original image dimensions to verify aspect ratio
        local orig_dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$img")
        local orig_width=$(echo $orig_dimensions | cut -d'x' -f1)
        local orig_height=$(echo $orig_dimensions | cut -d'x' -f2)
        local orig_aspect=$(echo "scale=6; $orig_width / $orig_height" | bc)
        
        echo "Image $i: original dimensions: ${orig_width}x${orig_height}, aspect ratio: $orig_aspect"
        
        # Step 1: Create a version that maintains aspect ratio with letterboxing (for overlay)
        local letterboxed_image="$temp_slideshow_dir/image_${i}_letterboxed.png"
        ffmpeg -hide_banner -loglevel warning -nostdin \
            -i "$img" \
            -vf "scale=$target_width:$target_height:force_original_aspect_ratio=decrease,pad=$target_width:$target_height:(ow-iw)/2:(oh-ih)/2:color=black" \
            "$letterboxed_image" 2>/dev/null
        
        # Step 2: Create a version that fills the entire frame by scaling and cropping (for blurring)
        local filled_image="$temp_slideshow_dir/image_${i}_filled.png"
        ffmpeg -hide_banner -loglevel warning -nostdin \
            -i "$img" \
            -vf "scale=$target_width:$target_height:force_original_aspect_ratio=increase,crop=$target_width:$target_height" \
            "$filled_image" 2>/dev/null
        
        # Step 3: Blur the filled version to create a blurred background
        local blurred_image="$temp_slideshow_dir/image_${i}_blurred.png"
        ffmpeg -hide_banner -loglevel warning -nostdin \
            -i "$filled_image" \
            -vf "boxblur=20:5" \
            "$blurred_image" 2>/dev/null
        
        # Step 4: Extract the actual image content from the letterboxed version
        # Calculate dimensions of the actual image within the letterboxed version
        if (( $(echo "$orig_aspect > $target_aspect" | bc -l) )); then
            # Width-constrained (letterboxed on top/bottom)
            local content_width=$target_width
            local content_height=$(echo "scale=0; $target_width / $orig_aspect" | bc)
            local x_offset=0
            local y_offset=$(echo "scale=0; ($target_height - $content_height) / 2" | bc)
        else
            # Height-constrained (letterboxed on sides)
            local content_height=$target_height
            local content_width=$(echo "scale=0; $target_height * $orig_aspect" | bc)
            local x_offset=$(echo "scale=0; ($target_width - $content_width) / 2" | bc)
            local y_offset=0
        fi
        
        # Extract just the image content
        local content_only="$temp_slideshow_dir/image_${i}_content.png"
        ffmpeg -hide_banner -loglevel warning -nostdin \
            -i "$letterboxed_image" \
            -vf "crop=$content_width:$content_height:$x_offset:$y_offset" \
            "$content_only" 2>/dev/null
        
        # Step 5: Create the segment with the blurred background and proper overlay
        ffmpeg -hide_banner -loglevel warning -nostdin \
            -loop 1 -i "$blurred_image" \
            -loop 1 -i "$content_only" \
            -t "$time_per_image" \
            -filter_complex "[1:v]format=rgba[content];[0:v][content]overlay=($target_width-w)/2:($target_height-h)/2:format=auto,format=yuv420p[v]" -map "[v]" \
            -c:v libx264 -preset fast -crf 23 -movflags +faststart \
            -pix_fmt yuv420p \
            "$segment_file" 2>&1 | tee "$temp_slideshow_dir/segment_${i}_ffmpeg.log"
            
        # Check if segment was created successfully
        if [[ -f "$segment_file" && -s "$segment_file" ]]; then
            local out_dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$segment_file")
            echo "Segment $i successfully created with dimensions: $out_dimensions"
        else
            echo -e "${RED}Failed to create segment for image: $base_img${NC}"
        fi
        
        i=$((i+1))
    done
    
    # Create a concatenation file
    local concat_file="$temp_slideshow_dir/concat.txt"
    > "$concat_file"  # Clear file
    
    # Check if any segments were created
    if [[ ${#segment_list[@]} -eq 0 ]]; then
        echo -e "${RED}No video segments were created. Skipping.${NC}"
        return 1
    fi
    
    # Add each segment to the concat file
    for segment in "${segment_list[@]}"; do
        if [[ -f "$segment" && -s "$segment" ]]; then
            echo "file '$segment'" >> "$concat_file"
        fi
    done
    
    # Concatenate the segments and add audio
    echo "Concatenating videos and adding audio for '$folder_display'..."
    
    # Create the final concatenated video with audio
    ffmpeg -hide_banner -loglevel warning -nostdin \
        -f concat -safe 0 -i "$concat_file" \
        -i "$audio_file" \
        -c:v copy -c:a aac -shortest \
        -movflags +faststart \
        "$output_file" >/dev/null 2>&1
    
    # Check if the output file was created
    if [[ -f "$output_file" && -s "$output_file" ]]; then
        echo -e "${GRN}Slideshow merge succeeded for '$folder_display'.${NC}"
        echo -e "Video successfully created: $(basename "$output_file")"
        return 0
    else
        echo -e "${RED}Failed to create slideshow for '$folder_display'.${NC}"
        return 1
    fi
}

##############################################
# Function: find_matching_audio
# Finds a matching audio file for an image or folder
##############################################
find_matching_audio() {
    local post_path="$1"
    local audio_dir="$2"
    
    local post_basename=$(basename "$post_path")
    local post_noext="${post_basename%.*}"  # Remove extension if present
    
    # First, try exact match (ignoring extension)
    while IFS= read -r -d '' audio_file; do
        local a_basename=$(basename "$audio_file")
        local a_noext="${a_basename%.*}"
        
        if [[ "$a_noext" == "$post_noext" ]]; then
            echo "$audio_file"
            return 0
        fi
    done < <(find "$audio_dir" -maxdepth 1 -type f -name "*.mp3" -print0)
    
    # Try partial match
    while IFS= read -r -d '' audio_file; do
        local a_basename=$(basename "$audio_file")
        local a_noext="${a_basename%.*}"
        
        # Check if one contains the other
        if [[ "$a_noext" == *"$post_noext"* ]] || [[ "$post_noext" == *"$a_noext"* ]]; then
            echo "$audio_file"
            return 0
        fi
    done < <(find "$audio_dir" -maxdepth 1 -type f -name "*.mp3" -print0)
    
    # Try simplified filenames
    local post_san=$(sanitize_filename "$post_basename")
    while IFS= read -r -d '' audio_file; do
        local a_basename=$(basename "$audio_file")
        local a_san=$(sanitize_filename "$a_basename")
        
        # See if simplified names match or are similar
        if [[ "$a_san" == *"$post_san"* ]] || [[ "$post_san" == *"$a_san"* ]]; then
            echo "$audio_file"
            return 0
        fi
    done < <(find "$audio_dir" -maxdepth 1 -type f -name "*.mp3" -print0)
    
    # Try word matching as last resort
    local post_lower=$(echo "$post_noext" | tr '[:upper:]' '[:lower:]')
    local words=($post_lower)
    
    for word in "${words[@]}"; do
        # Only use words with 5+ characters
        if [[ ${#word} -lt 5 ]]; then
            continue
        fi
        
        while IFS= read -r -d '' audio_file; do
            local a_basename=$(basename "$audio_file")
            local a_lower=$(echo "$a_basename" | tr '[:upper:]' '[:lower:]')
            
            if [[ "$a_lower" == *"$word"* ]]; then
                echo "$audio_file"
                return 0
            fi
        done < <(find "$audio_dir" -maxdepth 1 -type f -name "*.mp3" -print0)
    done
    
    # No match found
    return 1
}

##############################################
# Function: verify_aspect_ratio
# Checks if a video file has expected dimensions and aspect ratio
##############################################
verify_aspect_ratio() {
    local video_file="$1"
    local expected_width="$2"
    local expected_height="$3"
    
    if [[ ! -f "$video_file" || ! -s "$video_file" ]]; then
        echo "0" # File doesn't exist or is empty
        return 1
    fi
    
    # Get actual dimensions
    local dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$video_file")
    local width=$(echo $dimensions | cut -d'x' -f1)
    local height=$(echo $dimensions | cut -d'x' -f2)
    
    # Calculate aspect ratios
    local actual_aspect=$(echo "scale=6; $width / $height" | bc)
    local expected_aspect=$(echo "scale=6; $expected_width / $expected_height" | bc)
    
    # Check if dimensions match expectation
    if [[ "$width" -eq "$expected_width" && "$height" -eq "$expected_height" ]]; then
        echo "1" # Perfect match
        return 0
    fi
    
    # Calculate how far off the aspect ratio is (as a percentage)
    local ratio_diff=$(echo "scale=6; (($actual_aspect - $expected_aspect) / $expected_aspect) * 100" | bc)
    ratio_diff=${ratio_diff#-} # Remove negative sign if present
    
    # If within 1% tolerance, consider it acceptable
    if (( $(echo "$ratio_diff < 1" | bc -l) )); then
        echo "2" # Acceptable
        return 0
    else
        echo "3" # Bad aspect ratio
        return 1
    fi
}

##############################################
# Step A: Identifying posts (images and folders)
##############################################
echo -e "${YLW}Step A: Identifying posts (single images and folders)...${NC}"

# Verify the images directory exists
if [ ! -d "$IMAGES_DIR" ]; then
    echo "Error: Images directory not found: $IMAGES_DIR"
    exit 1
fi

# Find all single image files in the images directory
declare -a SINGLE_IMAGES
while IFS= read -r -d '' img; do
    # Skip blacklisted files
    if is_blacklisted "$img"; then
        echo -e "${RED}Skipping blacklisted file: $(basename "$img")${NC}"
        failed_posts+=("$(basename "$img") (blacklisted)")
        continue
    fi
    
    # Check if image is valid
    if is_image_valid "$img"; then
        echo "Found valid image: $img"
        SINGLE_IMAGES+=("$img")
    else
        echo -e "${RED}Found corrupted image, skipping: $img${NC}"
        corrupt_files+=("$img")
    fi
done < <(find "$IMAGES_DIR" -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) -print0)

# Find all folders in the images directory (multi-image posts)
declare -a FOLDERS
while IFS= read -r -d '' folder; do
    if [[ "$folder" != "$IMAGES_DIR/temp" ]] && [[ "$folder" != "$TEMP_DIR" ]]; then  # Skip temp directories
        echo "Found folder: $folder"
        FOLDERS+=("$folder")
    fi
done < <(find "$IMAGES_DIR" -maxdepth 1 -type d -not -path "$IMAGES_DIR" -print0)

echo "Found ${#SINGLE_IMAGES[@]} single images and ${#FOLDERS[@]} folders."

# Verify the audio directory exists
if [ ! -d "$AUDIO_DIR" ]; then
    echo "Error: Audio directory not found: $AUDIO_DIR"
    exit 1
fi

##############################################
# Step B: Collecting audio files
##############################################
echo -e "${YLW}\nStep B: Collecting audio files...${NC}"

# Count all the audio files
audio_count=$(find "$AUDIO_DIR" -maxdepth 1 -name "*.mp3" | wc -l)
echo "Found $audio_count audio files in $AUDIO_DIR"

##############################################
# Step C: Processing single images
##############################################
echo -e "${YLW}\nStep C: Processing single images...${NC}"

for img_path in "${SINGLE_IMAGES[@]}"; do
    img_basename=$(basename "$img_path")
    echo -e "\nProcessing image: $img_basename"
    
    # Find matching audio
    audio_file=$(find_matching_audio "$img_path" "$AUDIO_DIR")
    if [[ -z "$audio_file" ]]; then
        echo -e "${RED}No matching audio found for '$img_basename'. Skipping.${NC}"
        failed_posts+=("$img_basename (no audio)")
        continue
    fi
    
    audio_basename=$(basename "$audio_file")
    echo "Using audio: $audio_basename"
    
    # Create output filename
    output_name=$(sanitize_filename "$img_basename")
    output_path="$OUTPUT_DIR/${output_name}.mp4"
    
    # Process the image using the simpler approach that works well for single images
    echo "Using direct blur approach optimized for single images"
    if process_single_image "$img_path" "$audio_file" "$output_path"; then
        success_posts+=("$img_basename")
        echo "Video successfully created: $(basename "$output_path")"
    else
        failed_posts+=("$img_basename")
    fi
    
    echo "-----------------------------------------"
done

##############################################
# Step D: Processing folders (slideshows)
##############################################
echo -e "${YLW}\nStep D: Processing folders (slideshows)...${NC}"

for folder_path in "${FOLDERS[@]}"; do
    folder_name=$(basename "$folder_path")
    echo -e "\nProcessing folder: $folder_name"
    
    # Find matching audio
    audio_file=$(find_matching_audio "$folder_path" "$AUDIO_DIR")
    if [[ -z "$audio_file" ]]; then
        echo -e "${RED}No matching audio found for folder '$folder_name'. Skipping.${NC}"
        failed_posts+=("$folder_name (no audio)")
            continue
    fi
    
    audio_basename=$(basename "$audio_file")
    echo "Using audio: $audio_basename"
    
    # Create output filename
    output_name=$(sanitize_filename "$folder_name")
    output_path="$OUTPUT_DIR/${output_name}.mp4"
    
    # Process the folder as a slideshow
    if process_folder_slideshow "$folder_path" "$audio_file" "$output_path"; then
        success_posts+=("$folder_name")
        echo "Slideshow successfully created: $(basename "$output_path")"
    else
        failed_posts+=("$folder_name")
    fi
    
    echo "-----------------------------------------"
done

##############################################
# Final Summary
##############################################
echo -e "\n${YLW}Final Summary:${NC}"
success_count=${#success_posts[@]}
echo "Total posts found: $((${#SINGLE_IMAGES[@]} + ${#FOLDERS[@]}))"
echo "Successful merges: $success_count"
echo "Failed merges:     ${#failed_posts[@]}"
echo "Corrupt files:     ${#corrupt_files[@]}"
echo "Blacklisted files: ${#BLACKLIST[@]}"

# Verify aspect ratios of output videos
echo -e "\n${YLW}Aspect Ratio Verification:${NC}"
declare -a bad_aspect_ratio_videos=()
declare -a good_aspect_ratio_videos=()
declare -a perfect_aspect_ratio_videos=()

# Check all output videos
for video in "$OUTPUT_DIR"/*.mp4; do
    if [[ -f "$video" && -s "$video" ]]; then
        video_name=$(basename "$video")
        verification=$(verify_aspect_ratio "$video" 720 1280)
        
        case "$verification" in
            "1")
                perfect_aspect_ratio_videos+=("$video_name")
                ;;
            "2")
                good_aspect_ratio_videos+=("$video_name")
                ;;
            "3")
                # Get actual dimensions for reporting
                dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$video")
                bad_aspect_ratio_videos+=("$video_name ($dimensions)")
                ;;
            *)
                # Failed verification for other reasons
                bad_aspect_ratio_videos+=("$video_name (unknown issue)")
                ;;
        esac
    fi
done

# Report verification results
echo "Videos with perfect aspect ratio (720x1280): ${#perfect_aspect_ratio_videos[@]}"
echo "Videos with acceptable aspect ratio: ${#good_aspect_ratio_videos[@]}"
echo "Videos with problematic aspect ratio: ${#bad_aspect_ratio_videos[@]}"

if [[ ${#bad_aspect_ratio_videos[@]} -gt 0 ]]; then
    echo -e "${RED}These videos have problematic aspect ratios:${NC}"
    for bad_video in "${bad_aspect_ratio_videos[@]}"; do
        echo " - $bad_video"
    done
else
    echo -e "${GRN}All videos have correct or acceptable aspect ratios!${NC}"
fi

if [[ ${#corrupt_files[@]} -gt 0 ]]; then
    echo -e "${RED}These files were corrupted:${NC}"
    for cf in "${corrupt_files[@]}"; do
        echo " - $(basename "$cf")"
    done
fi

if [[ ${#failed_posts[@]} -gt 0 ]]; then
    echo -e "${RED}These posts failed or were skipped:${NC}"
    for fp in "${failed_posts[@]}"; do
        echo " - $fp"
    done
else
    echo -e "${GRN}No posts failed. All good!${NC}"
fi

echo -e "\nAll done! Check the '$OUTPUT_DIR' folder for final videos."

